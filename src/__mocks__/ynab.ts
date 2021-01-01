export const mocks = {
  budgets: {
    getBudgets: jest.fn()
  },
  accounts: {
    getAccounts: jest.fn()
  }
};

export const API = jest.fn(() => mocks);
