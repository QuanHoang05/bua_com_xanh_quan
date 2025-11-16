/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  // Chỉ định các tệp kiểm thử của bạn ở trong thư mục test
  testMatch: ["<rootDir>/test/**/*.test.js"],
};

export default config;
