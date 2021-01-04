export const mocks = {
  getItems: jest.fn(),
  getRefunds: jest.fn(),
  getShipments: jest.fn(),
  stop: jest.fn(),
};

export const AmazonOrderReportsApi = jest.fn(() => mocks);
