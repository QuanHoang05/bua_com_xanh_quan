// backend/test/admin.tasks.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// --- GIẢ LẬP (MOCK) CÁC MODULES ---
// Giả lập DB và middleware để test logic của API một cách độc lập.
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
jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
    requireRole: () => (req, res, next) => next(),
}));

// Hàm tiện ích tạo token JWT giả
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

// Mô tả bộ test cho các route quản lý tác vụ (tasks) của admin
describe("Admin Tasks Routes (/api/admin/tasks)", () => {
  const adminUser = { id: 'admin-456', role: 'admin' };
  const adminToken = signTestToken(adminUser);

  // ==================================
  // BỘ TEST VỚI MÔI TRƯỜNG SQLITE
  // ==================================
  describe("with SQLite DB", () => {
    let app;
    let sqliteDb;

    // Cài đặt môi trường test cho SQLite
    beforeAll(async () => {
      process.env.DB_DRIVER = "sqlite";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const dbModule = await import("../src/lib/db.js");
      sqliteDb = dbModule.db;
      sqliteDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
      });

      const { default: adminRouter } = await import("../src/routes/admin.js");
      
      app = express();
      app.use(express.json());
      app.use("/api/admin", adminRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Test case: Lấy danh sách các tác vụ thành công (có phân trang)
    test("GET /tasks should return items", async () => {
      // Giả lập 2 lần gọi DB: 1 để lấy danh sách, 1 để lấy tổng số lượng
      sqliteDb.prepare
        .mockReturnValueOnce({ all: () => [{ id: 1, title: 'Task 1'}] })
        .mockReturnValueOnce({ get: () => ({ total: 1 }) });
      
      const res = await request(app).get("/api/admin/tasks").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và có 1 item trong danh sách
      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });
  });

  // =================================
  // BỘ TEST VỚI MÔI TRƯỜNG MYSQL
  // =================================
  describe("with MySQL DB", () => {
    let app;
    let mysqlDb;

    // Cài đặt môi trường test cho MySQL
    beforeAll(async () => {
      process.env.DB_DRIVER = "mysql";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const dbModule = await import("../src/lib/db.mysql.js");
      mysqlDb = dbModule.db;
      mysqlDb.all.mockResolvedValue([]);
      mysqlDb.run.mockResolvedValue({});
      mysqlDb.query.mockResolvedValue([[]]);
      mysqlDb.get.mockResolvedValue(null);

      const { default: adminRouter } = await import("../src/routes/admin.js");
      
      app = express();
      app.use(express.json());
      app.use("/api/admin", adminRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Test case: Tạo một tác vụ mới thành công
    test("POST /tasks should create a task", async () => {
      // Giả lập các lệnh gọi DB: 1 để lấy thứ tự sắp xếp lớn nhất, 1 để ghi tác vụ mới
      mysqlDb.get.mockResolvedValue({ m: 0 }); // For getting max sort order
      mysqlDb.run.mockResolvedValue({});
      
      const res = await request(app).post("/api/admin/tasks").set("Authorization", `Bearer ${adminToken}`).send({ title: 'New Task'});
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // Test case: Cập nhật thông tin của một tác vụ thành công
    test("PATCH /tasks/:id should update a task", async () => {
      // Giả lập hàm ghi DB
      mysqlDb.run.mockResolvedValue({});
      const res = await request(app).patch("/api/admin/tasks/1").set("Authorization", `Bearer ${adminToken}`).send({ title: 'Updated Task'});
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
