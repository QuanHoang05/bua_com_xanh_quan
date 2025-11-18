/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {}, // Sử dụng transform mặc định của Node.js cho ESM
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  // Match integration tests placed under IntegrationTest/tests
  testMatch: ["<rootDir>/IntegrationTest/tests/**/*.test.js"],
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
  // `setupFiles` runs BEFORE the test framework is installed.
  // Use it to set up the environment (e.g., env vars).
  setupFiles: ["<rootDir>/IntegrationTest/jest.env.js"],
  // `setupFilesAfterEnv` runs AFTER the test framework is installed.
  // Use it for test-specific setup like beforeAll/beforeEach hooks.
  setupFilesAfterEnv: ["<rootDir>/IntegrationTest/setup.integration.js"],
};

export default config;
