// backend/test/admin.metrics.test.js
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

// Mô tả bộ test cho các route lấy số liệu thống kê (metrics) của admin
describe("Admin Metrics Routes (/api/admin/metrics)", () => {
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

    // Test case: Lấy thống kê về tỉ lệ giao hàng thành công
    test("GET /metrics/delivery-success should return delivery stats", async () => {
      // Giả lập DB trả về số lượng đơn theo từng trạng thái
      sqliteDb.prepare.mockReturnValue({ all: () => [{ status: 'delivered', c: 10 }, { status: 'pending', c: 5 }] });
      
      const res = await request(app).get("/api/admin/metrics/delivery-success").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và API tính toán đúng số liệu
      expect(res.statusCode).toBe(200);
      expect(res.body.delivered).toBe(10);
      expect(res.body.total).toBe(15);
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

    // Test case: Lấy dữ liệu cho bản đồ nhiệt (heatmap)
    test("GET /metrics/heatmap should return heatmap data", async () => {
      // Giả lập 2 lần gọi DB: 1 để lấy tọa độ food, 1 để lấy tọa độ booking
      mysqlDb.all.mockResolvedValueOnce([{ lat: 10,lng: 20 }]) // foods
                 .mockResolvedValueOnce([{ lat: 11, lng: 21 }]); // bookings
      
      const res = await request(app).get("/api/admin/metrics/heatmap").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và API trả về mảng dữ liệu gồm 2 điểm
      expect(res.statusCode).toBe(200);
      expect(res.body.cells).toHaveLength(2);
    });
  });
});
