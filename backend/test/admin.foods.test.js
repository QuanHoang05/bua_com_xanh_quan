// backend/test/admin.foods.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
    requireRole: () => (req, res, next) => next(),
}));

// Hàm tiện ích tạo token JWT giả
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

describe.each([
  { driver: "sqlite", dbModulePath: "../src/lib/db.js" },
  { driver: "mysql", dbModulePath: "../src/lib/db.mysql.js" },
])("Admin Foods Routes with $driver DB", ({ driver, dbModulePath }) => {
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
    jest.unstable_mockModule(dbModulePath, () => ({ db: {} }));

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

  test("GET /foods should return food items", async () => {
    mockDbFunctions.all.mockResolvedValue([{ id: 1 }]);
    mockDbFunctions.get.mockResolvedValue({ total: 1 });

    const res = await request(app).get("/api/admin/foods").set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  test("DELETE /foods/:id should hide a food item", async () => {
    mockDbFunctions.run.mockResolvedValue({});

    const res = await request(app)
      .delete("/api/admin/foods/food-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
  });

  test("PATCH /foods/:id should update a food item", async () => {
    const foodId = 'food-123';
    const updatedFood = { id: foodId, title: 'Updated Title', status: 'available', owner_id: 'user-1', quantity: 10, expires_at: '2025-01-01' };
    mockDbFunctions.run.mockResolvedValue({ affectedRows: 1 });
    mockDbFunctions.get.mockResolvedValueOnce(updatedFood);

    const res = await request(app)
      .patch(`/api/admin/foods/${foodId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' });

    expect(res.statusCode).toBe(200);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
    expect(res.body.title).toBe('Updated Title');
  });
});
