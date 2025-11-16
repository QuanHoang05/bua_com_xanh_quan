-- backend/testAPIreal/seed_db.sql
-- File này chứa các câu lệnh để xóa và tạo lại dữ liệu cho database test.
-- Nó được gọi bởi script `reset-db.js`.

-- Tắt kiểm tra khóa ngoại để có thể xóa bảng theo bất kỳ thứ tự nào
SET FOREIGN_KEY_CHECKS=0;

-- Xóa sạch dữ liệu cũ trong các bảng quan trọng
TRUNCATE TABLE users;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE donations;
TRUNCATE TABLE food_items;
TRUNCATE TABLE bookings;
TRUNCATE TABLE deliveries;
-- Thêm các bảng khác nếu cần

-- Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS=1;

-- Chèn dữ liệu mẫu

-- 1. Một tài khoản admin để test các quyền đặc biệt
-- Mật khẩu là 'adminpassword'
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `status`) VALUES ('admin-test-01', 'admin@test.com', '$2b$10$V/A.x6h3kC5Fz3Y2a9E.d.aW3c3b4E5F6G7H8i9J0k1L2M3n4O5p', 'Admin Test', 'admin', 'active');

-- 2. Một tài khoản người dùng (donor/recipient) thông thường
-- Mật khẩu là 'userpassword'
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `status`) VALUES ('user-test-01', 'user@test.com', '$2b$10$A/B.c4d5e6F7g8H9i0J1k.l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z', 'User Test', 'user', 'active');