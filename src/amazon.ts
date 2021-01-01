import { AmazonOrderReportsApi, Cookie, LogLevel } from 'amazon-order-reports-api';
import hasha from 'hasha';
import inquirer from 'inquirer';
import { SaveTransaction } from 'ynab';
import { readCache, writeCache } from './cache';
import { getConfig } from './config';

const config = getConfig();

export type AmazonTransaction = Omit<SaveTransaction, 'account_id'>;
type IdRecord = Record<string, number>;

const prompt = async (message: string, type: 'input' | 'password' = 'input') =>
  (await inquirer.prompt([{ name: 'p', message, type }]))?.p;

const getUsername = async (): Promise<string> =>
  config.amazonUsername ?? (await prompt('Amazon Username:'));
const getPassword = async (): Promise<string> =>
  config.amazonPassword ?? (await prompt('Amazon Password:', 'password'));
const getOtpCode = async (): Promise<string> =>
  config.amazonOtpCode ?? (await prompt('Amazon OTP Code:'));

const generateImportId = (idInputs: Array<string | number | Date>, seenIds: IdRecord): string => {
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
  type: 'item' | 'refund',
  orderId: string,
  date: Date,
  asinIsbn: string,
  title: string,
  seller: string,
  quantity: number,
  amount: number,
): AmazonTransaction => ({
  amount: Math.round(amount * 1000),
  date: `${date.toISOString().split('T')[0]}`,
  import_id: generateImportId(
    [type, orderId, date, asinIsbn, title, seller, quantity, amount],
    seenIds,
  ),
  memo: title ? `${quantity > 1 ? `${quantity} x ` : ''}${title}`.substr(0, 200) : '',
  payee_name: seller,
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
    puppeteerOpts: config.debugMode ? { headless: false, slowMo: 100 } : {},
  });

  try {
    for await (const item of api.getItems({
      startDate: new Date(config.startDate),
      endDate: new Date(),
    })) {
      if (item.itemTotal) {
        yield createTransation(
          seenIds,
          'item',
          item.orderId,
          item.orderDate,
          item.asinIsbn,
          item.title,
          item.seller,
          item.quantity,
          -item.itemTotal,
        );
      }
    }

    for await (const refund of api.getRefunds({
      startDate: new Date(config.startDate),
      endDate: new Date(),
    })) {
      if (refund.refundAmount) {
        yield createTransation(
          seenIds,
          'refund',
          refund.orderId,
          refund.orderDate,
          refund.asinIsbn,
          refund.title,
          refund.seller,
          refund.quantity,
          refund.refundAmount,
        );
      }
    }
  } finally {
    if (config.debugMode) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    await api.stop();
  }
};
