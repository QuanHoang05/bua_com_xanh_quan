/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  // Match only Jest-style integration tests placed under IntegrationTest/jest
  testMatch: ["<rootDir>/IntegrationTest/jest/**/*.test.js"],
  // Custom reporters for integration tests
  reporters: [
    "default",
    [
      "<rootDir>/test-reporter.cjs",
      {
        outputPath: "<rootDir>/test-reports",
        pageTitle: "Báo cáo Integration Test - Bữa Cơm Xanh",
      },
    ],
  ],
  // Increase timeout for integration tests
  testTimeout: 30000,
};

export default config;
