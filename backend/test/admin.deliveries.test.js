// backend/test/admin.deliveries.test.js
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

// Mô tả bộ test cho các route quản lý vận chuyển (deliveries) của admin
describe("Admin Deliveries Routes (/api/admin/deliveries)", () => {
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

    // Test case: Lấy danh sách các đơn vận chuyển thành công
    test("GET /deliveries should return a list of deliveries", async () => {
      // Giả lập DB trả về một danh sách mẫu
      sqliteDb.prepare.mockReturnValue({ all: () => [{ id: 1, status: 'assigned' }] });
      const res = await request(app).get("/api/admin/deliveries").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và nhận được 1 item
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    // Test case: Gán một đơn đặt (booking) cho shipper để tạo đơn vận chuyển mới
    test("POST /deliveries/assign should assign a delivery", async () => {
      // Giả lập các lệnh gọi DB: 1 để lấy booking, 1 để tạo delivery, 1 để ghi log
      sqliteDb.prepare
        .mockReturnValueOnce({ get: () => ({ id: 'booking-1', qty: 5 }) }) // for tryGet booking
        .mockReturnValueOnce({ run: jest.fn() }) // for tryRun insert delivery
        .mockReturnValueOnce({ run: jest.fn() }); // for logAudit call
      
      const res = await request(app).post("/api/admin/deliveries/assign").set("Authorization", `Bearer ${adminToken}`).send({ booking_id: 'booking-1', shipper_id: 'shipper-1' });
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
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

    // Test case: Cập nhật trạng thái của một đơn vận chuyển
    test("PATCH /deliveries/:id should update a delivery", async () => {
      // Giả lập hàm ghi vào DB
      mysqlDb.run.mockResolvedValue({});
      const res = await request(app).patch("/api/admin/deliveries/1").set("Authorization", `Bearer ${adminToken}`).send({ status: 'completed' });
      
      // Mong đợi status 200 và response ok
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
