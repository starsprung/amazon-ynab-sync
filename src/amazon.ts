import { AmazonOrderReportsApi, Cookie, LogLevel } from 'amazon-order-reports-api';
import hasha from 'hasha';
import inquirer from 'inquirer';
import { SaveTransaction } from 'ynab-client';
import { readCache, writeCache } from './cache';
import { getConfig } from './config';
import { getPuppeteerExecutable } from './puppeteer';
import get from 'lodash.get';

const config = getConfig();

export type AmazonTransaction = Omit<SaveTransaction, 'account_id'>;
type IdRecord = Record<string, number>;
type Totals = Record<string, number>;

const prompt = async (message: string, type: 'input' | 'password' = 'input') =>
  (await inquirer.prompt([{ name: 'p', message, type }]))?.p;

const getUsername = async (): Promise<string> =>
  config.amazonUsername ?? (await prompt('Amazon Username:'));
const getPassword = async (): Promise<string> =>
  config.amazonPassword ?? (await prompt('Amazon Password:', 'password'));
const getOtpCode = async (): Promise<string> =>
  config.amazonOtpCode ?? (await prompt('Amazon OTP Code:'));

const generateImportId = (
  idInputs: Array<string | number | Date | undefined>,
  seenIds: IdRecord,
): string => {
  const baseHash = hasha(
    idInputs.map((v) => `${v instanceof Date ? v.toISOString() : v}`),
    { algorithm: 'sha256' },
  );

  const occurence = seenIds[baseHash] ?? 0;
  seenIds[baseHash] = occurence + 1;

  return hasha([baseHash, `${occurence}`], { algorithm: 'sha256' }).substr(0, 36);
};

const createTransation = (
  seenIds: IdRecord,
  type: 'item' | 'refund' | 'shipping' | 'promotion' | 'misc',
  {
    orderId,
    date,
    asinIsbn,
    title,
    seller,
    quantity,
    amount,
  }: {
    orderId: string;
    date: Date;
    asinIsbn?: string;
    title?: string;
    seller?: string;
    quantity?: number;
    amount: number;
  },
): AmazonTransaction => ({
  amount: Math.round(amount * 1000),
  cleared: config.cleared
    ? SaveTransaction.ClearedEnum.Cleared
    : SaveTransaction.ClearedEnum.Uncleared,
  date: `${date.toISOString().split('T')[0]}`,
  import_id: generateImportId(
    [type, orderId, date, asinIsbn, title, seller, quantity, amount],
    seenIds,
  ),
  memo:
    type === 'shipping'
      ? `Shipping for ${orderId}`
      : type === 'promotion'
      ? `Promotion for ${orderId}`
      : type === 'misc'
      ? `Misc adjustment for ${orderId}`
      : title
      ? `${(quantity ?? 0) > 1 ? `${quantity} x ` : ''}${title}`.substr(0, 200)
      : '',
  payee_name: seller ?? 'Amazon.com',
});

export const getAmazonTransactions = async function* (): AsyncGenerator<AmazonTransaction> {
  const seenIds: IdRecord = {};

  const api = new AmazonOrderReportsApi({
    username: getUsername,
    password: getPassword,
    otpSecret: config.amazonOtpSecret,
    otpFn: getOtpCode,
    logLevel: config.logLevel as LogLevel,
    cookies: ((await readCache('cookies')) as Array<Cookie>) ?? [],
    saveCookiesFn: (cookies: Array<Cookie>) => writeCache('cookies', cookies),
    puppeteerOpts: {
      executablePath: await getPuppeteerExecutable(),
      ...(config.debugMode ? { headless: false, slowMo: 100 } : {}),
    },
  });

  const itemSubtotals: Totals = {};
  const itemTotals: Totals = {};
  const shipmentSubtotals: Totals = {};
  const shipmentPromotionTotals: Totals = {};
  const shipmentShippingTotals: Totals = {};
  const shipmentTotals: Totals = {};
  const orderDates: Record<string, Date> = {};

  try {
    for await (const item of api.getItems({
      startDate: new Date(config.startDate),
      endDate: new Date(),
    })) {
      if (item.itemTotal) {
        yield createTransation(seenIds, 'item', {
          orderId: item.orderId,
          date: item.orderDate,
          asinIsbn: item.asinIsbn,
          title: item.title,
          seller: item.seller,
          quantity: item.quantity,
          amount: -item.itemTotal,
        });
      }

      itemSubtotals[item.orderId] =
        get(itemSubtotals, item.orderId, 0) + get(item, 'itemSubtotal', 0);
      itemTotals[item.orderId] = get(itemTotals, item.orderId, 0) + get(item, 'itemTotal', 0);
    }

    for await (const item of api.getRefunds({
      startDate: new Date(config.startDate),
      endDate: new Date(),
    })) {
      if (item.refundAmount) {
        yield createTransation(seenIds, 'refund', {
          orderId: item.orderId,
          date: item.orderDate,
          asinIsbn: item.asinIsbn,
          title: item.title,
          seller: item.seller,
          quantity: item.quantity,
          amount: item.refundAmount,
        });
      }
    }

    for await (const item of api.getShipments({
      startDate: new Date(config.startDate),
      endDate: new Date(),
    })) {
      if (item.shippingCharge) {
        yield createTransation(seenIds, 'shipping', {
          orderId: item.orderId,
          date: item.orderDate,
          amount: -item.shippingCharge,
        });

        shipmentShippingTotals[item.orderId] =
          get(shipmentShippingTotals, item.orderId, 0) + get(item, 'shippingCharge', 0);
      }

      if (item.totalPromotions) {
        yield createTransation(seenIds, 'promotion', {
          orderId: item.orderId,
          date: item.orderDate,
          amount: item.totalPromotions,
        });

        shipmentPromotionTotals[item.orderId] =
          get(shipmentPromotionTotals, item.orderId, 0) + get(item, 'totalPromotions', 0);
      }

      shipmentSubtotals[item.orderId] =
        get(shipmentSubtotals, item.orderId, 0) + get(item, 'subtotal', 0);
      shipmentTotals[item.orderId] =
        get(shipmentTotals, item.orderId, 0) + get(item, 'totalCharged', 0);
      orderDates[item.orderId] = item.orderDate;
    }

    // Find adjustments not accounted for by shipping/promotions (giftwrap, etc)
    for (const [orderId, itemSubtotal] of Object.entries(itemSubtotals)) {
      const shipmentSubtotal = shipmentSubtotals[orderId];

      // if subtotals are significantly different, skip it as this order has likely
      // not finished shipping
      if (Math.abs(shipmentSubtotal - itemSubtotal) > 0.01) {
        continue;
      }

      const itemTotal = get(itemTotals, orderId, 0);
      const shipmentPromotionTotal = get(shipmentPromotionTotals, orderId, 0);
      const shipmentShippingTotal = get(shipmentShippingTotals, orderId, 0);
      const shipmentTotal = get(shipmentTotals, orderId, 0);
      const orderDate = orderDates[orderId];

      const unaccountedDifference =
        shipmentTotal - (itemTotal + shipmentShippingTotal - shipmentPromotionTotal);

      if (unaccountedDifference > 0.01) {
        yield createTransation(seenIds, 'misc', {
          orderId,
          date: orderDate,
          amount: -unaccountedDifference,
        });
      }
    }
  } finally {
    if (config.debugMode) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    await api.stop();
  }
};
