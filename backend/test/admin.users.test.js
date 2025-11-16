// backend/test/admin.users.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// --- MOCK MODULES ---
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

const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

describe("Admin Users Routes (/api/admin/users)", () => {
  const adminUser = { id: 'admin-456', role: 'admin' };
  const adminToken = signTestToken(adminUser);

  // =======================
  // TEST SUITE FOR SQLITE
  // =======================
  describe("with SQLite DB", () => {
    let app;
    let sqliteDb;

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

    // Kiểm tra chức năng lấy danh sách người dùng.
    test("GET /users should return a list of users", async () => {
        const mockUsers = [{ id: 'user-1', name: 'Test User 1' }];
        sqliteDb.prepare
            .mockReturnValueOnce({ all: () => mockUsers })
            .mockReturnValueOnce({ get: () => ({ total: 1 }) })
            .mockReturnValue({ all: () => [] });

        const res = await request(app)
            .get("/api/admin/users")
            .set("Authorization", `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.total).toBe(1);
    });
  });

  // =======================
  // TEST SUITE FOR MYSQL
  // =======================
  describe("with MySQL DB", () => {
    let app;
    let mysqlDb;

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

    // Kiểm tra chức năng lấy danh sách người dùng.
    test("GET /users should return a list of users", async () => {
        const mockUsers = [{ id: 'user-1', name: 'Test User 1', roles: [] }];
        mysqlDb.all.mockResolvedValueOnce(mockUsers).mockResolvedValue([]);
        mysqlDb.get.mockResolvedValue({ total: 1 });

        const res = await request(app)
            .get("/api/admin/users")
            .set("Authorization", `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.total).toBe(1);
    });

    // Kiểm tra chức năng cập nhật thông tin và vai trò của người dùng.
    test("PATCH /users/:id should update a user", async () => {
        const userId = 'user-123';
        const updatedUser = { id: userId, name: 'Updated Name', role: 'shipper' };
        mysqlDb.run.mockResolvedValueOnce({});
        mysqlDb.all.mockResolvedValueOnce([{ role: 'shipper' }]);
        mysqlDb.get.mockResolvedValueOnce(updatedUser);
        
        const res = await request(app)
            .patch(`/api/admin/users/${userId}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: 'Updated Name', roles: ['shipper'] });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe('Updated Name');
        expect(res.body.role).toBe('shipper');
    });
  });
});