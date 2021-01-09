import { normalize } from 'path';
import { Config } from '../config';

const mocks = {
  amazonOtpCode: jest.fn(() => '54321'),
  amazonPassword: jest.fn(() => 'pass123456'),
  amazonUsername: jest.fn(() => 'user@example.com'),
  cacheDir: jest.fn(() => normalize('/path/to/cache/')),
  cleared: jest.fn(() => true),
  logLevel: jest.fn(() => 'none'),
  payee: jest.fn(() => undefined),
  ynabAccessToken: jest.fn(() => 'f82918ba-4aa7-4805-b9be-fe5e87eaacf3'),
  ynabAccountName: jest.fn(() => 'Amazon.com'),
  ynabBudgetName: jest.fn(() => 'Budget'),
};

const config = Object.defineProperties(
  {},
  Object.fromEntries(Object.entries(mocks).map(([k, v]) => [k, { get: v, configurable: true }])),
);

export const getConfig = jest.fn(() => config as Config);
