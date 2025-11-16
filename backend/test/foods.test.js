// backend/test/foods.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

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
  },
}));

describe("Food Routes (/api/foods)", () => {
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

  // =======================
  // TEST SUITE FOR SQLITE
  // =======================
  describe("with SQLite DB", () => {
    let app;
    let sqliteDb;

    beforeAll(async () => {
      process.env.DB_DRIVER = "sqlite";
      jest.resetModules();

      const { default: foodsRouter } = await import("../src/routes/foods.js");
      const dbModule = await import("../src/lib/db.js");
      sqliteDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/foods", foodsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy danh sách thực phẩm (public).
    test("GET / should return a list of food items", async () => {
      const getMock = jest.fn().mockReturnValue({ total: 1 });
      const allMock = jest.fn().mockReturnValue([mockFoodItem]);
      sqliteDb.prepare
        .mockReturnValueOnce({ get: getMock })   // For the COUNT(*) query
        .mockReturnValueOnce({ all: allMock });  // For the main list query

      const res = await request(app).get("/api/foods");

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(mockFoodItem.id);
      expect(res.body.total).toBe(1);
      // Check that tags and images are parsed
      expect(Array.isArray(res.body.items[0].tags)).toBe(true);
      expect(Array.isArray(res.body.items[0].images)).toBe(true);
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
      jest.resetModules();

      const { default: foodsRouter } = await import("../src/routes/foods.js");
      const dbModule = await import("../src/lib/db.mysql.js");
      mysqlDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/foods", foodsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy danh sách thực phẩm (public).
    test("GET / should return a list of food items", async () => {
      mysqlDb.get.mockResolvedValue({ total: 1 });
      mysqlDb.all.mockResolvedValue([mockFoodItem]);

      const res = await request(app).get("/api/foods");

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(mockFoodItem.id);
      expect(res.body.total).toBe(1);
    });
  });
});