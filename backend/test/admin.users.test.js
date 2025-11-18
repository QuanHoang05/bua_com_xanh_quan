// backend/test/admin.users.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";

jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
    requireRole: () => (req, res, next) => next(),
}));

const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

import request from "supertest";
import express from "express";

jest.unstable_mockModule("../src/lib/db.js", () => ({ db: { prepare: jest.fn() } }));
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({ db: { get: jest.fn(), all: jest.fn(), run: jest.fn(), query: jest.fn() } }));

describe.each([
  { driver: "sqlite", dbModulePath: "../src/lib/db.js" },
  { driver: "mysql", dbModulePath: "../src/lib/db.mysql.js" },
])("Admin Users Routes with $driver DB", ({ driver, dbModulePath }) => {
  const adminUser = { id: 'admin-456', role: 'admin' };
  const adminToken = signTestToken(adminUser);
  let app;
  let db;
  const mockDbFunctions = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    query: jest.fn(),
  };

  beforeAll(async () => {
    process.env.DB_DRIVER = driver;
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();

    const dbModule = await import(dbModulePath);
    db = dbModule.db;

    if (driver === "sqlite") {
      db.prepare = jest.fn(() => mockDbFunctions);
    } else {
      db.run = mockDbFunctions.run;
      db.all = mockDbFunctions.all;
      db.get = mockDbFunctions.get;
      db.query = mockDbFunctions.query;
    }

    const { default: adminRouter } = await import("../src/routes/admin.js");
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRouter);
  });

  beforeEach(() => {
    mockDbFunctions.run.mockClear();
    mockDbFunctions.get.mockClear();
    mockDbFunctions.all.mockClear();
    mockDbFunctions.query.mockClear();
  });

  test("GET /users should return a list of users", async () => {
    const mockUsers = [{ id: 'user-1', name: 'Test User 1', roles: [] }];
    mockDbFunctions.all.mockResolvedValueOnce(mockUsers).mockResolvedValue([]);
    mockDbFunctions.get.mockResolvedValue({ total: 1 });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  test("PATCH /users/:id should update a user", async () => {
    const userId = 'user-123';
    const updatedUser = { id: userId, name: 'Updated Name', role: 'shipper' };
    mockDbFunctions.run.mockResolvedValue({});
    mockDbFunctions.all.mockResolvedValueOnce([{ role: 'shipper' }]);
    mockDbFunctions.get.mockResolvedValueOnce(updatedUser);

    const res = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: 'Updated Name', roles: ['shipper'] });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.role).toBe('shipper');
  });
});