/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  clearMocks: true,
  testTimeout: 30000,
  transform: {},
  verbose: true,
  // Chỉ tìm các file test trong thư mục testAPIreal
  testMatch: ["**/testAPIreal/**/*.test.js"],
  // Một file setup sẽ chạy trước mỗi bộ test, dùng để dọn dẹp CSDL
  setupFilesAfterEnv: ["<rootDir>/testAPIreal/setup.js"],
};

export default config;