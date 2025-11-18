// backend/test/foods.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

describe.each([
  { driver: "sqlite", dbModulePath: "../src/lib/db.js" },
  { driver: "mysql", dbModulePath: "../src/lib/db.mysql.js" },
])("Food Routes with $driver DB", ({ driver, dbModulePath }) => {
  const mockFoodItem = {
    id: "food-123",
    title: "Test Food Item",
    description: "A food item for testing",
    qty: 10,
    unit: "kg",
    status: "available",
    visibility: "public",
    tags: JSON.stringify(["test", "food"]),
    images: JSON.stringify(["image.jpg"]),
  };
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

    const { default: foodsRouter } = await import("../src/routes/foods.js");
    app = express();
    app.use(express.json());
    app.use("/api/foods", foodsRouter);
  });

  test("GET / should return a list of food items", async () => {
    mockDbFunctions.get.mockResolvedValue({ total: 1 });
    mockDbFunctions.all.mockResolvedValue([mockFoodItem]);

    const res = await request(app).get("/api/foods");

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(mockFoodItem.id);
    expect(res.body.total).toBe(1);
  });
});