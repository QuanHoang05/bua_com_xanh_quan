// backend/testAPIreal/setup.js
import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import { cleanupDatabase, seedData, closePool } from './dbHelper.js';
import bcrypt from 'bcrypt';

/**
 * beforeAll: Chạy một lần duy nhất trước khi tất cả các test trong bộ test suite bắt đầu.
 * Nhiệm vụ: Dọn dẹp CSDL lần đầu để đảm bảo môi trường sạch sẽ.
 */
beforeAll(async () => {
  await cleanupDatabase();
});

/**
 * beforeEach: Chạy trước mỗi test case (mỗi hàm `test(...)`).
 * Nhiệm vụ: Dọn dẹp và seed lại dữ liệu mẫu. Điều này đảm bảo mỗi test case
 * bắt đầu với một trạng thái CSDL nhất quán, không bị ảnh hưởng bởi test case trước đó.
 */
beforeEach(async () => {
  await cleanupDatabase();

  // Seed dữ liệu người dùng mẫu
  const adminPassword = await bcrypt.hash('adminpassword', 10);
  const userPassword = await bcrypt.hash('userpassword', 10);

  await seedData('users', [
    { id: 'admin-test-01', email: 'admin@test.com', password_hash: adminPassword, name: 'Admin Test', role: 'admin', status: 'active' },
    { id: 'user-test-01', email: 'user@test.com', password_hash: userPassword, name: 'User Test', role: 'user', status: 'active' },
  ]);
});

/**
 * afterAll: Chạy một lần duy nhất sau khi tất cả các test đã hoàn thành.
 * Nhiệm vụ: Đóng kết nối CSDL để Jest có thể thoát hoàn toàn.
 */
afterAll(async () => {
  await closePool();
});