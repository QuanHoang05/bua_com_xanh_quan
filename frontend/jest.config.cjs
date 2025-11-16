/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  testEnvironment: "jsdom",
  passWithNoTests: true,
  testPathIgnorePatterns: ["/node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Báo cáo HTML tùy chỉnh (tiếng Việt) - Tạo báo cáo đẹp sau mỗi lần chạy test
  reporters: [
    "default",
    [
      "../backend/test-reporter.cjs",
      {
        outputPath: "<rootDir>/test-reports",
        pageTitle: "Báo cáo Test Frontend - Bữa Cơm Xanh",
      },
    ],
  ],
};

module.exports = config;
