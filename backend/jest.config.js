/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  // Chỉ định các thư mục chứa tệp test.
  // Jest sẽ tìm các tệp có đuôi .test.js hoặc .spec.js trong các thư mục này.
  // Bao gồm cả thư mục `test` cho unit test và `IntegrationTest` cho integration test.
  roots: ["<rootDir>/test", "<rootDir>/IntegrationTest"],

  // Báo cáo HTML tùy chỉnh (tiếng Việt) - Tạo báo cáo đẹp sau mỗi lần chạy test
  reporters: [
    "default",
    [
      "<rootDir>/test-reporter.cjs",
      {
        outputPath: "<rootDir>/test-reports",
        pageTitle: "Báo cáo Test Backend - Bữa Cơm Xanh",
      },
    ],
  ],
};

export default config;
