// backend/test/admin.announcements.test.js
import {
  jest,
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// --- GIẢ LẬP (MOCK) CÁC MODULES ---
// Thay vì dùng database thật, chúng ta giả lập các hàm của DB để kiểm tra logic của API.
// Điều này giúp test chạy nhanh, không phụ thuộc vào DB và có thể giả định các kết quả trả về.
jest.unstable_mockModule("../src/lib/db.js", () => ({
  db: {
    prepare: jest.fn(),
  },
}));
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    query: jest.fn(),
  },
}));

// Giả lập middleware kiểm tra quyền, cho phép mọi request đi qua để tập trung test logic của route.
jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
  requireRole: () => (req, res, next) => next(),
}));

// Giả lập ensure-mysql để tránh lỗi khi route load
jest.unstable_mockModule("../src/lib/ensure-mysql.js", () => ({
  ensureMySQLSchema: jest.fn().mockResolvedValue(undefined),
}));

// Hàm tiện ích để tạo một token JWT giả cho việc test xác thực
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
};

// Sử dụng describe.each để chạy cùng một bộ test cho cả hai môi trường DB
describe.each([
  { driver: "sqlite", dbModulePath: "../src/lib/db.js" },
  { driver: "mysql", dbModulePath: "../src/lib/db.mysql.js" },
])("Admin Announcements Routes with $driver DB", ({ driver, dbModulePath }) => {
  const adminUser = { id: "admin-456", role: "admin" };
  const adminToken = signTestToken(adminUser); // Tạo token cho user admin giả
  let app;
  let db;

  // Tạo các mock function dùng chung cho cả 2 loại DB
  const mockDbFunctions = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    query: jest.fn(), // Dùng cho MySQL
  };

  // Chạy 1 lần trước tất cả các test trong bộ này
  beforeAll(async () => {
    process.env.DB_DRIVER = driver; // Thiết lập môi trường DB tương ứng
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules(); // Reset module cache để load lại với env mới

    // Import các module đã được mock
    const dbModule = await import(dbModulePath);
    db = dbModule.db;

    // Thiết lập mock dựa trên loại DB
    if (driver === "sqlite") {
      // Với SQLite, mock hàm prepare để trả về các mock function chung
      db.prepare.mockReturnValue(mockDbFunctions);
    } else {
      // Với MySQL, gán trực tiếp các mock function chung
      db.run = mockDbFunctions.run;
      db.all = mockDbFunctions.all;
      db.get = mockDbFunctions.get;
      db.query = mockDbFunctions.query;
    }

    // Import và cài đặt app Express với router cần test
    const { default: adminRouter } = await import("../src/routes/admin.js");
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRouter);
  });

  // Chạy trước mỗi test để reset các mock
  beforeEach(() => {
    // Reset tất cả các mock trước mỗi test để đảm bảo sự độc lập
    jest.clearAllMocks();
    // Đảm bảo mọi truy vấn DB đều trả về mảng rỗng (tránh undefined.length)
    mockDbFunctions.all.mockResolvedValue([]);
    mockDbFunctions.run.mockResolvedValue({});
    mockDbFunctions.get.mockResolvedValue(null);
    mockDbFunctions.query.mockResolvedValue([[], null]); // MySQL format: [rows, metadata]
    // Nếu có chỗ nào gọi trực tiếp db.query mà không destructure, trả về [] luôn
    db.query = jest.fn().mockResolvedValue([[], null]);
    db.all = jest.fn().mockResolvedValue([]);
    // Reset sqlite prepare mock
    db.prepare?.mockReturnValue(mockDbFunctions);
  });

  // Test case: Lấy danh sách thông báo thành công
  test("GET /announcements should return a list", async () => {
    const mockData = [
      {
        id: 1,
        title: "Test Announcement",
        content: "Content",
        level: "info",
        active: 1,
      },
    ];
    // Giả lập DB trả về dữ liệu mẫu
    mockDbFunctions.all.mockResolvedValue(mockData);
    db.all = jest.fn().mockResolvedValue(mockData);

    // Gửi request và kiểm tra kết quả
    const res = await request(app)
      .get("/api/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].title).toBe("Test Announcement");
  });

  // Test case: Tạo một thông báo mới thành công
  test("POST /announcements should create an item", async () => {
    // Gửi request tạo mới
    const res = await request(app)
      .post("/api/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "New", content: "Content" });

    // Mong đợi status 200 và hàm run được gọi 2 lần (1 cho INSERT, 1 cho ghi log audit)
    expect(res.statusCode).toBe(200);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
  });

  // Test case: Cập nhật một thông báo thành công
  test("PATCH /announcements/:id should update an item", async () => {
    const res = await request(app)
      .patch("/api/admin/announcements/1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Updated" });

    // Mong đợi status 200 và hàm run được gọi 2 lần (UPDATE + audit log)
    expect(res.statusCode).toBe(200);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
  });

  // Test case: Xóa một thông báo thành công
  test("DELETE /announcements/:id should delete an item", async () => {
    const res = await request(app)
      .delete("/api/admin/announcements/1")
      .set("Authorization", `Bearer ${adminToken}`);

    // Mong đợi status 200 và hàm run được gọi 2 lần (DELETE + audit log)
    expect(res.statusCode).toBe(200);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
  });
});
