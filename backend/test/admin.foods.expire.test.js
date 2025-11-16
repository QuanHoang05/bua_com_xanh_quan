// backend/test/admin.foods.expire.test.js
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

// Mô tả bộ test cho route xử lý thực phẩm hết hạn
describe("Admin Foods Expire Routes (/api/admin/foods/expire-now)", () => {
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

    // Test case: Kích hoạt chức năng chuyển trạng thái thực phẩm sang 'expired'
    test("POST /foods/expire-now should expire food items", async () => {
      const runMock = jest.fn();
      // Giả lập hàm ghi DB
      sqliteDb.prepare.mockReturnValue({ run: runMock });
      
      const res = await request(app).post("/api/admin/foods/expire-now").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      // Mong đợi hàm ghi DB được gọi 2 lần (1 cho UPDATE thực phẩm, 1 cho ghi log audit)
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

    // Test case: Kích hoạt chức năng chuyển trạng thái thực phẩm sang 'expired'
    test("POST /foods/expire-now should expire food items", async () => {
      // Giả lập hàm ghi DB
      mysqlDb.run.mockResolvedValue({});
      const res = await request(app).post("/api/admin/foods/expire-now").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      // Mong đợi hàm ghi DB được gọi 2 lần (1 cho UPDATE thực phẩm, 1 cho ghi log audit)
      expect(mysqlDb.run).toHaveBeenCalledTimes(2);
    });
  });
});
