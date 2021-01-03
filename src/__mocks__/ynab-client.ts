import { SaveTransaction } from 'ynab-client';

export const mocks = {
  accounts: {
    getAccounts: jest.fn(),
  },
  budgets: {
    getBudgets: jest.fn(),
  },
  transactions: {
    createTransactions: jest.fn(),
  },
};

export const API = jest.fn(() => mocks);

export { SaveTransaction };
