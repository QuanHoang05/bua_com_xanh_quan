// backend/test/admin.campaigns.test.js
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

// Mô tả bộ test cho các route quản lý chiến dịch (campaigns) của admin
describe("Admin Campaigns Routes (/api/admin/campaigns)", () => {
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

    // Test case: Lấy danh sách các chiến dịch thành công (có phân trang)
    test("GET /campaigns should return a list of campaigns", async () => {
      // Giả lập 2 lần gọi DB: 1 để lấy tổng số lượng, 1 để lấy danh sách items
      sqliteDb.prepare
        .mockReturnValueOnce({ get: () => ({ total: 1 }) })
        .mockReturnValueOnce({ all: () => [{ id: 1, title: 'Admin Campaign' }] });
      
      const res = await request(app).get("/api/admin/campaigns").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và có 1 item trong danh sách trả về
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

    // Test case: Lấy danh sách các chiến dịch thành công (có phân trang)
    test("GET /campaigns should return a list of campaigns", async () => {
      // Giả lập 2 lần gọi DB: 1 để lấy tổng số lượng, 1 để lấy danh sách items
      mysqlDb.get.mockResolvedValueOnce({ total: 1 });
      mysqlDb.all.mockResolvedValueOnce([{ id: 1, title: 'Admin Campaign' }]);
      
      const res = await request(app).get("/api/admin/campaigns").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và có 1 item trong danh sách trả về
      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });
  });
});