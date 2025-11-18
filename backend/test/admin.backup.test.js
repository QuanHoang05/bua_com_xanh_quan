// backend/test/admin.backup.test.js
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

// Mô tả bộ test cho các route sao lưu và phục hồi dữ liệu
describe("Admin Backup/Restore Routes (/api/admin/backup, /api/admin/restore)", () => {
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

    // Test case: Sao lưu (backup) toàn bộ dữ liệu hệ thống thành công
    test("GET /backup should return a backup JSON", async () => {
      // Giả lập các lệnh gọi DB để lấy dữ liệu từ các bảng, trả về mảng rỗng
      sqliteDb.prepare.mockReturnValue({ all: () => [] });
      
      const res = await request(app).get("/api/admin/backup").set("Authorization", `Bearer ${adminToken}`);
      
      // Mong đợi status 200 và response body có cấu trúc của file backup
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('ok', true);
      expect(res.body).toHaveProperty('tables');
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

    // Test case: Phục hồi (restore) dữ liệu từ một file JSON thành công
    test("POST /restore should restore data from JSON", async () => {
      // Giả lập hàm ghi vào DB
      mysqlDb.run.mockResolvedValue({});
      
      // Gửi request restore với dữ liệu mẫu
      const res = await request(app).post("/api/admin/restore").set("Authorization", `Bearer ${adminToken}`).send({ tables: { users: [{ id: 'u1' }] } });
      
      // Mong đợi status 200, response ok và hàm ghi DB đã được gọi
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mysqlDb.run).toHaveBeenCalled();
    });
  });
});