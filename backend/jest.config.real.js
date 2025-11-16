// backend/jest.config.real.js

/** @type {import('jest').Config} */
const config = {
  // Môi trường test là Node.js
  testEnvironment: 'node',

  // Tự động dọn dẹp mock sau mỗi bài test.
  clearMocks: true,

  // Thời gian chờ tối đa cho một bài test (ví dụ: 30 giây).
  // Cần thiết vì test với DB thật và network có thể chậm hơn.
  testTimeout: 30000,

  // Cần thiết để Jest có thể xử lý cú pháp ES Modules (import/export).
  transform: {},

  // Hiển thị chi tiết kết quả của từng bài test.
  verbose: true,

  // Một tệp sẽ được chạy MỘT LẦN trước khi toàn bộ test suite bắt đầu.
  // Lý tưởng để reset database về trạng thái ban đầu.
  setupFilesAfterEnv: ['<rootDir>/testAPIreal/setup.js'], // Đường dẫn này bây giờ đã chính xác

  // Chỉ tìm các file có đuôi .real.test.js trong thư mục testAPIreal
  testMatch: ['**/testAPIreal/**/*.real.test.js'],
};

export default config;