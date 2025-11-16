/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  // Chỉ định các tệp kiểm thử của bạn ở trong thư mục test
  testMatch: ["<rootDir>/test/**/*.test.js"],
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
