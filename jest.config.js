module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ['default', ['jest-junit', { outputDirectory: 'test-output' }]],
  coverageDirectory: '../coverage',
  rootDir: './src',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts']
};
