// backend/test/admin.foods.test.js
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

// Mô tả bộ test cho các route quản lý thực phẩm (foods) của admin
describe("Admin Foods Routes (/api/admin/foods)", () => {
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

    // Test case: Lấy danh sách thực phẩm thành công (có phân trang)
    test("GET /foods should return food items", async () => {
      // Giả lập 2 lần gọi DB: 1 để lấy danh sách, 1 để lấy tổng số lượng
      sqliteDb.prepare
        .mockReturnValueOnce({ all: () => [{ id: 1 }] })
        .mockReturnValueOnce({ get: () => ({ total: 1 }) });
      
      const res = await request(app).get("/api/admin/foods").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và có 1 item trong danh sách
      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    // Test case: Ẩn một mục thực phẩm (soft delete)
    test("DELETE /foods/:id should hide a food item", async () => {
      const runMock = jest.fn();
      // Giả lập hàm ghi DB
      sqliteDb.prepare.mockReturnValue({ run: runMock });

      const res = await request(app)
        .delete("/api/admin/foods/food-1")
        .set("Authorization", `Bearer ${adminToken}`);

      // Mong đợi status 200
      expect(res.statusCode).toBe(200);
      // Mong đợi hàm ghi DB được gọi 2 lần: 1 cho UPDATE (để ẩn food), 1 cho INSERT (ghi log audit)
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

    // Test case: Cập nhật thông tin của một mục thực phẩm
    test("PATCH /foods/:id should update a food item", async () => {
      const foodId = 'food-123';
      const updatedFood = { id: foodId, title: 'Updated Title' };
      // Giả lập 2 lần gọi DB: 1 cho UPDATE, 1 cho SELECT để lấy lại item đã update
      mysqlDb.run.mockResolvedValueOnce({}); // For the UPDATE
      mysqlDb.get.mockResolvedValueOnce(updatedFood); // For the final SELECT

      const res = await request(app)
        .patch(`/api/admin/foods/${foodId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: 'Updated Title' });
      
      // Mong đợi status 200 và title của item trả về đã được cập nhật
      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });
  });
});
