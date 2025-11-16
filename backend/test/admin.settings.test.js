// backend/test/admin.settings.test.js
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

// Mô tả bộ test cho các route quản lý cài đặt trang (site settings)
describe("Admin Site Settings Routes (/api/admin/settings)", () => {
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

    // Test case: Lấy tất cả cài đặt của trang thành công
    test("GET /settings should return settings object", async () => {
      // Giả lập DB trả về một danh sách các cặp key-value
      sqliteDb.prepare.mockReturnValue({ all: () => [{ k: 'test', v: 'value' }] });
      const res = await request(app).get("/api/admin/settings").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và body là một object chứa các cài đặt
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('test', 'value');
    });

    // Test case: Cập nhật (hoặc tạo mới) một hoặc nhiều cài đặt
    test("PUT /settings should update settings", async () => {
      const runMock = jest.fn();
      // Giả lập các lệnh gọi DB: 1 để kiểm tra tồn tại, 1 để ghi, 1 để log
      sqliteDb.prepare
        .mockReturnValueOnce({ get: () => null }) // For exists check
        .mockReturnValueOnce({ run: runMock })   // For INSERT/UPDATE
        .mockReturnValueOnce({ run: runMock });  // For logAudit

      const res = await request(app).put("/api/admin/settings").set("Authorization", `Bearer ${adminToken}`).send({ key1: 'val1' });

      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      // Mong đợi hàm ghi DB được gọi 2 lần (ghi setting + ghi log)
      expect(runMock).toHaveBeenCalledTimes(2);
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

    // Test case: Lấy cấu hình gợi ý (recommendation config)
    test("GET /reco-config should return reco weights", async () => {
      // Giả lập DB trả về một chuỗi JSON chứa cấu hình
      mysqlDb.get.mockResolvedValue({ v: JSON.stringify({ distance: 0.5 }) });
      const res = await request(app).get("/api/admin/reco-config").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và nhận được đúng giá trị cấu hình
      expect(res.statusCode).toBe(200);
      expect(res.body.distance).toBe(0.5);
    });

    // Test case: Cập nhật cấu hình gợi ý
    test("PUT /reco-config should update reco weights", async () => {
      // Giả lập hàm ghi DB
      mysqlDb.run.mockResolvedValue({});
      const res = await request(app).put("/api/admin/reco-config").set("Authorization", `Bearer ${adminToken}`).send({ distance: 0.6 });
      
      // Mong đợi status 200, response ok và hàm ghi DB được gọi 2 lần (ghi setting + ghi log)
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mysqlDb.run).toHaveBeenCalledTimes(2);
    });
  });
});
