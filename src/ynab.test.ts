import mockdate from 'mockdate';
import { mocked } from 'ts-jest/utils';
import { readCache, writeCache } from './cache';
import { addTransactions, getAccountId, getBudgetId } from './ynab';
import { mocks as ynabMocks, SaveTransaction } from './__mocks__/ynab-client';

jest.mock('./cache');
jest.mock('./config');

describe('account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockdate.set('2021-01-31');
  });

  afterEach(() => {
    mockdate.reset();
  });

  describe('getBudgetId', () => {
    it('should use cached ID if one exists', async () => {
      const budgetId = '7400b90c-9324-4a36-b754-7f06c8e53eef';
      const mock = mocked(readCache).mockResolvedValueOnce(budgetId);

      const result = await getBudgetId('my budget');
      expect(mock).toBeCalledWith(['f82918ba-4aa7-4805-b9be-fe5e87eaacf3', 'my budget'], 3600000);
      expect(result).toEqual(budgetId);
    });

    it('should get ID from API if no cached value exists', async () => {
      const budgetId = 'f4cc821a-d79a-4c45-86d8-3c477352cbdd';

      ynabMocks.budgets.getBudgets.mockResolvedValueOnce({
        data: {
          budgets: [
            {
              id: budgetId,
              name: 'my budget',
            },
          ],
        },
      });

      const result = await getBudgetId('my budget');
      expect(mocked(writeCache)).toBeCalledWith(
        ['f82918ba-4aa7-4805-b9be-fe5e87eaacf3', 'my budget'],
        budgetId,
      );
      expect(result).toEqual(budgetId);
    });

    it('throw error if budget does not exist', async () => {
      expect(getAccountId('my budget', 'amazon.com account')).rejects.toThrow(
        'Unable to find budget',
      );
    });
  });

  describe('getAccountId', () => {
    it('should use cached ID if one exists', async () => {
      const accountId = '42ed9b93-4f94-4164-ac88-72eb54d818ed';
      const mock = mocked(readCache).mockResolvedValueOnce(accountId);

      const result = await getAccountId('my budget', 'amazon.com account');
      expect(mock).toBeCalledWith(
        ['f82918ba-4aa7-4805-b9be-fe5e87eaacf3', 'my budget', 'amazon.com account'],
        3600000,
      );
      expect(result).toEqual(accountId);
    });

    it('should get ID from API if no cached value exists', async () => {
      const budgetId = 'f4cc821a-d79a-4c45-86d8-3c477352cbdd';
      const accountId = '42ed9b93-4f94-4164-ac88-72eb54d818ed';

      ynabMocks.budgets.getBudgets.mockResolvedValueOnce({
        data: {
          budgets: [
            {
              id: budgetId,
              name: 'my budget',
            },
          ],
        },
      });

      ynabMocks.accounts.getAccounts.mockResolvedValueOnce({
        data: {
          accounts: [
            {
              id: accountId,
              name: 'amazon.com account',
            },
          ],
        },
      });

      const result = await getAccountId('my budget', 'amazon.com account');
      expect(ynabMocks.accounts.getAccounts).toBeCalledWith(budgetId);
      expect(mocked(writeCache)).toBeCalledWith(
        ['f82918ba-4aa7-4805-b9be-fe5e87eaacf3', 'my budget', 'amazon.com account'],
        accountId,
      );
      expect(result).toEqual(accountId);
    });

    it('throw error if account does not exist', async () => {
      const budgetId = 'f4cc821a-d79a-4c45-86d8-3c477352cbdd';

      ynabMocks.budgets.getBudgets.mockResolvedValueOnce({
        data: {
          budgets: [
            {
              id: budgetId,
              name: 'my budget',
            },
          ],
        },
      });

      expect(getAccountId('my budget', 'amazon.com account')).rejects.toThrow(
        'Unable to find account',
      );
    });
  });

  describe('addTransactions', () => {
    it('should send transactions to YNAB', async () => {
      const budgetId = 'f4cc821a-d79a-4c45-86d8-3c477352cbdd';
      const accountId = '42ed9b93-4f94-4164-ac88-72eb54d818ed';

      ynabMocks.budgets.getBudgets
        .mockResolvedValueOnce({
          data: {
            budgets: [
              {
                id: budgetId,
                name: 'Budget',
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            budgets: [
              {
                id: budgetId,
                name: 'Budget',
              },
            ],
          },
        });

      ynabMocks.accounts.getAccounts.mockResolvedValueOnce({
        data: {
          accounts: [
            {
              id: accountId,
              name: 'Amazon.com',
            },
          ],
        },
      });

      await addTransactions([
        {
          amount: 12345,
          cleared: SaveTransaction.ClearedEnum.Cleared,
          date: '2020-12-31',
          import_id: 'b10500b5a731520b3fd242589d6cc0bc4fc1',
          memo: 'Very small rocks',
          payee_name: 'Amazon.com',
        },
      ]);

      expect(ynabMocks.transactions.createTransactions).toBeCalledWith(
        'f4cc821a-d79a-4c45-86d8-3c477352cbdd',
        {
          transactions: [
            {
              account_id: '42ed9b93-4f94-4164-ac88-72eb54d818ed',
              amount: 12345,
              cleared: 'cleared',
              date: '2020-12-31',
              import_id: 'b10500b5a731520b3fd242589d6cc0bc4fc1',
              memo: 'Very small rocks',
              payee_name: 'Amazon.com',
            },
          ],
        },
      );
    });
  });
});
