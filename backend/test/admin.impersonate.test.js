// backend/test/admin.impersonate.test.js
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

// Mô tả bộ test cho chức năng "giả danh" (impersonate) của admin
describe("Admin Impersonate Routes (/api/admin/impersonate)", () => {
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

    // Test case: Admin giả danh một user khác thành công
    test("POST /impersonate should return a new token for the impersonated user", async () => {
      const mockUser = { id: 'user-to-impersonate', email: 'impersonated@test.com', role: 'user' };
      // Giả lập DB trả về thông tin của user cần giả danh
      sqliteDb.prepare.mockReturnValueOnce({ get: () => mockUser });
      
      // Admin gửi request giả danh user có id là mockUser.id
      const res = await request(app).post("/api/admin/impersonate").set("Authorization", `Bearer ${adminToken}`).send({ user_id: mockUser.id });
      
      // Mong đợi status 200, nhận được token mới và thông tin của user đã giả danh
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.id).toBe(mockUser.id);
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

    // Test case: Admin giả danh một user khác thành công
    test("POST /impersonate should return a new token for the impersonated user", async () => {
      const mockUser = { id: 'user-to-impersonate', email: 'impersonated@test.com', role: 'user' };
      // Giả lập DB trả về thông tin của user cần giả danh
      mysqlDb.get.mockResolvedValueOnce(mockUser);

      // Admin gửi request giả danh user có id là mockUser.id
      const res = await request(app).post("/api/admin/impersonate").set("Authorization", `Bearer ${adminToken}`).send({ user_id: mockUser.id });
      
      // Mong đợi status 200, nhận được token mới và thông tin của user đã giả danh
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.id).toBe(mockUser.id);
    });
  });
});