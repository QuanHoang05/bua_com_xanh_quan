// backend/test/admin.pages.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// --- GIẢ LẬP (MOCK) CÁC MODULES ---
jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
    requireRole: () => (req, res, next) => next(),
}));

// Hàm tiện ích tạo token JWT giả
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

// Mô tả bộ test cho các route quản lý trang nội dung (CMS Pages)
describe("Admin CMS Pages Routes (/api/admin/pages)", () => {
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
      jest.unstable_mockModule("../src/lib/db.js", () => ({
        db: {
          prepare: jest.fn(),
        },
      }));

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

    // Test case: Tạo một trang nội dung mới thành công
    test("POST /pages should create a page", async () => {
      const runMock = jest.fn();
      // Giả lập hàm ghi DB
      sqliteDb.prepare.mockReturnValue({ run: runMock });
      
      const res = await request(app).post("/api/admin/pages").set("Authorization", `Bearer ${adminToken}`).send({ slug: 'new-page', title: 'New Page' });
      
      // Mong đợi status 200 và hàm ghi DB được gọi 2 lần (1 cho INSERT trang, 1 cho ghi log audit)
      expect(res.statusCode).toBe(200);
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
      jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
        db: {
          get: jest.fn(),
          all: jest.fn(),
          run: jest.fn(),
          query: jest.fn(),
        },
      }));


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

    // Test case: Lấy danh sách các trang nội dung thành công
    test("GET /pages should return a list of pages", async () => {
      // Giả lập DB trả về một danh sách mẫu
      mysqlDb.all.mockResolvedValue([{ id: 1, slug: 'page-1' }]);
      const res = await request(app).get("/api/admin/pages").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và nhận được 1 item
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    // Test case: Xóa một trang nội dung thành công
    test("DELETE /pages/:id should delete a page", async () => {
      // Giả lập hàm ghi DB
      mysqlDb.run.mockResolvedValue({});
      const res = await request(app).delete("/api/admin/pages/1").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và hàm ghi DB được gọi 2 lần (1 cho DELETE trang, 1 cho ghi log audit)
      expect(res.statusCode).toBe(200);
      expect(mysqlDb.run).toHaveBeenCalledTimes(2);
    });
  });
});
