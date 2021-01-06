import { OrderItem, Refund, Shipment } from 'amazon-order-reports-api';
import inquirer from 'inquirer';
import mockdate from 'mockdate';
import { mocked } from 'ts-jest/utils';
import { AmazonTransaction, getAmazonTransactions } from './amazon';
import { readCache, writeCache } from './cache';
import { getConfig } from './config';
import {
  AmazonOrderReportsApi,
  mocks as amazonOrderReportsApiMocks,
} from './__mocks__/amazon-order-reports-api';

jest.mock('inquirer');
jest.mock('./cache');
jest.mock('./config');

describe('amazon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockdate.set('2021-01-31');
  });

  afterEach(() => {
    mockdate.reset();
  });

  describe('getAmazonTransactions', () => {
    beforeEach(() => {
      mocked(amazonOrderReportsApiMocks).getItems.mockImplementationOnce(async function* () {
        yield* [
          {
            asinIsbn: 'B06Y5XG33Q',
            buyerName: 'Test Man',
            carrierNameTrackingNumber: 'USPS(9300120111405739275629)',
            category: 'HEALTH_PERSONAL_CARE',
            condition: 'new',
            currency: 'USD',
            itemSubtotal: 21.75,
            itemSubtotalTax: 0,
            itemTotal: 21.75,
            listPricePerUnit: 0,
            orderDate: new Date('2020-01-03T08:00:00.000Z'),
            orderId: '123-7654321-1234567',
            orderStatus: 'Shipped',
            orderingCustomerEmail: 'email@example.com',
            paymentInstrumentType: 'Visa - 1234',
            purchasePricePerUnit: 21.75,
            quantity: 1,
            seller: 'This Is A Seller',
            shipmentDate: new Date('2020-01-06T08:00:00.000Z'),
            shippingAddressCity: 'Washington',
            shippingAddressName: 'Test Man',
            shippingAddressState: 'DC',
            shippingAddressStreet1: '1600 Pennsylvania Avenue NW',
            shippingAddressZip: '20500',
            title: 'Some Product',
            unspscCode: '38462846',
            website: 'Amazon.com',
          } as OrderItem,
        ];
      });

      mocked(amazonOrderReportsApiMocks.getRefunds).mockImplementationOnce(async function* () {
        yield* [
          {
            asinIsbn: 'B07USNDYEK',
            buyerName: 'Test Man',
            category: 'COAT',
            orderDate: new Date('2020-01-14T08:00:00.000Z'),
            orderId: '113-5757575-3939393',
            quantity: 2,
            refundAmount: 75.98,
            refundCondition: 'Completed',
            refundDate: new Date('2020-01-25T08:00:00.000Z'),
            refundReason: 'Customer Return',
            refundTaxAmount: 0,
            seller: 'A Seller',
            title: 'Some kind of coat',
            website: 'Amazon.com',
          } as Refund,
          {
            asinIsbn: 'B07USNDYEK',
            buyerName: 'Test Man',
            category: 'COAT',
            orderDate: new Date('2020-01-14T08:00:00.000Z'),
            orderId: '113-5757575-3939393',
            quantity: 2,
            refundAmount: 75.98,
            refundCondition: 'Completed',
            refundDate: new Date('2020-01-25T08:00:00.000Z'),
            refundReason: 'Customer Return',
            refundTaxAmount: 0,
            seller: 'A Seller',
            title: 'Some kind of coat',
            website: 'Amazon.com',
          } as Refund,
        ];
      });

      mocked(amazonOrderReportsApiMocks).getShipments.mockImplementationOnce(async function* () {
        yield* [
          {
            buyerName: 'Test Man',
            carrierNameTrackingNumber: 'FEDEX(536485026870)',
            orderDate: new Date('2020-02-22T08:00:00.000Z'),
            orderId: '112-1234569-3333333',
            orderStatus: 'Shipped',
            orderingCustomerEmail: 'test@example.com',
            paymentInstrumentType: 'American Express - 1236',
            shipmentDate: new Date('2020-02-23T08:00:00.000Z'),
            shippingAddressCity: 'Washington',
            shippingAddressName: 'Test Man',
            shippingAddressState: 'DC',
            shippingAddressStreet1: '1600 Pennsylvania Avenue NW',
            shippingAddressZip: '20500',
            shippingCharge: 17.99,
            subtotal: 489.95,
            taxBeforePromotions: 0,
            taxCharged: 0,
            totalCharged: 507.94,
            totalPromotions: 10.51,
            website: 'Amazon.com',
          } as Shipment,
        ];
      });
    });

    it('should return transactions from amazon', async () => {
      const result: Array<AmazonTransaction> = [];
      for await (const transaction of getAmazonTransactions()) {
        result.push(transaction);
      }

      expect(result).toEqual([
        {
          amount: -21750,
          cleared: 'cleared',
          date: '2020-01-03',
          import_id: '6128e2d42a9b71f2680e46bd90c53fcdb8fe',
          memo: 'Some Product',
          payee_name: 'This Is A Seller',
        },
        {
          amount: 75980,
          cleared: 'cleared',
          date: '2020-01-14',
          import_id: '9b026229af8f0894ddcd8b575d28859e7357',
          memo: '2 x Some kind of coat',
          payee_name: 'A Seller',
        },
        {
          amount: 75980,
          cleared: 'cleared',
          date: '2020-01-14',
          import_id: '113728ab6700037b5a466b9b01dd0806f26c',
          memo: '2 x Some kind of coat',
          payee_name: 'A Seller',
        },
        {
          amount: -17990,
          cleared: 'cleared',
          date: '2020-02-22',
          import_id: '58b86c94e423511cc8791c294f574c51f5e6',
          memo: 'Shipping for 112-1234569-3333333',
          payee_name: 'Amazon.com',
        },
        {
          amount: 10510,
          cleared: 'cleared',
          date: '2020-02-22',
          import_id: 'ab178dd06eeec28f129b1988305e0d4ee01d',
          memo: 'Promotion for 112-1234569-3333333',
          payee_name: 'Amazon.com',
        },
      ]);
    });

    it('should respect cleared configuration', async () => {
      const config = getConfig();
      jest.spyOn(config, 'cleared', 'get').mockReturnValueOnce(false);

      const result: Array<AmazonTransaction> = [];
      for await (const transaction of getAmazonTransactions()) {
        result.push(transaction);
      }

      expect(result[0]).toHaveProperty('cleared', 'uncleared');
    });

    it('should use different import_ids for identical items', async () => {
      const result: Array<AmazonTransaction> = [];
      for await (const transaction of getAmazonTransactions()) {
        result.push(transaction);
      }

      expect(result[1].import_id).not.toEqual(result[2]);
    });

    it('should use credentials from config', async () => {
      await getAmazonTransactions().next();

      // eslint-disable-next-line
      const [[{ username, password, otpFn }]] = AmazonOrderReportsApi.mock.calls as any;
      await expect(username()).resolves.toEqual('user@example.com');
      await expect(password()).resolves.toEqual('pass123456');
      await expect(otpFn()).resolves.toEqual('54321');
    });

    it('should prompt for username/password/otp if not provided in config', async () => {
      const config = getConfig();
      jest
        .spyOn(config, 'amazonUsername', 'get')
        .mockReturnValueOnce((undefined as unknown) as string);
      jest
        .spyOn(config, 'amazonPassword', 'get')
        .mockReturnValueOnce((undefined as unknown) as string);
      jest
        .spyOn(config, 'amazonOtpCode', 'get')
        .mockReturnValueOnce((undefined as unknown) as string);

      mocked(inquirer.prompt)
        .mockResolvedValueOnce({ p: 'test@example.com' })
        .mockResolvedValueOnce({ p: 'password1234' })
        .mockResolvedValueOnce({ p: '384739' });

      await getAmazonTransactions().next();

      // eslint-disable-next-line
      const [[{ username, password, otpFn }]] = AmazonOrderReportsApi.mock.calls as any;
      await expect(username()).resolves.toEqual('test@example.com');
      await expect(password()).resolves.toEqual('password1234');
      await expect(otpFn()).resolves.toEqual('384739');
    });

    it('should use cached cookies', async () => {
      const cookies = [
        {
          name: 'session-id-time',
          value: '2082787201l',
          domain: '.amazon.com',
          path: '/',
          expires: 1641091354.410037,
          size: 26,
          httpOnly: false,
          secure: false,
          session: false,
        },
      ];

      mocked(readCache).mockResolvedValueOnce(cookies);
      await getAmazonTransactions().next();
      expect(AmazonOrderReportsApi).toBeCalledWith(
        expect.objectContaining({
          cookies,
        }),
      );
    });

    it('should save cookies', async () => {
      const cookies = [
        {
          name: 'session-id-time',
          value: '2082787201l',
          domain: '.amazon.com',
          path: '/',
          expires: 1641091354.410037,
          size: 26,
          httpOnly: false,
          secure: false,
          session: false,
        },
      ];

      await getAmazonTransactions().next();
      // eslint-disable-next-line
      const [[{ saveCookiesFn }]] = AmazonOrderReportsApi.mock.calls as any;
      await saveCookiesFn(cookies);

      expect(writeCache).toBeCalledWith('cookies', cookies);
    });
  });
});
