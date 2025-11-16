// backend/test/campaigns.test.js
import {
  jest,
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
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
    query: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  },
}));

describe("Campaign Routes (/api/campaigns)", () => {
  const mockCampaign = {
    id: "camp-123",
    title: "Test Campaign",
    description: "A campaign for testing",
    goal: 1000000,
    raised_calc: 500000, // Mock calculated value
    supporters_calc: 10, // Mock calculated value
    status: "active",
    tags: JSON.stringify([{ type: "money" }]),
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

      const { default: campaignsRouter } = await import(
        "../src/routes/campaigns.js"
      );
      const dbModule = await import("../src/lib/db.js");
      sqliteDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/campaigns", campaignsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy danh sách các chiến dịch (public).
    test("GET / should return a list of campaigns", async () => {
      const getMock = jest.fn().mockReturnValue({ total: 1 });
      const allMock = jest.fn().mockReturnValue([mockCampaign]);
      sqliteDb.prepare
        .mockReturnValueOnce({ get: getMock }) // For the COUNT(*) query
        .mockReturnValueOnce({ all: allMock }); // For the main list query

      const res = await request(app).get("/api/campaigns");

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(mockCampaign.id);
      expect(res.body.total).toBe(1);
    });

    // Kiểm tra chức năng lấy thông tin chi tiết của một chiến dịch.
    test("GET /:id should return a single campaign", async () => {
      const getMock = jest.fn().mockReturnValue(mockCampaign);
      sqliteDb.prepare.mockReturnValue({ get: getMock });

      const res = await request(app).get(`/api/campaigns/${mockCampaign.id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.id).toBe(mockCampaign.id);
      expect(res.body.title).toBe(mockCampaign.title);
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

      const { default: campaignsRouter } = await import(
        "../src/routes/campaigns.js"
      );
      const dbModule = await import("../src/lib/db.mysql.js");
      mysqlDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/campaigns", campaignsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy danh sách các chiến dịch (public).
    test("GET / should return a list of campaigns", async () => {
      mysqlDb.query.mockResolvedValueOnce([[{ total: 1 }], null]);
      mysqlDb.query.mockResolvedValueOnce([[mockCampaign], null]);

      const res = await request(app).get("/api/campaigns");

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.items).toHaveLength(1);
    });

    // Kiểm tra chức năng lấy thông tin chi tiết của một chiến dịch.
    test("GET /:id should return a single campaign", async () => {
      mysqlDb.query.mockResolvedValueOnce([[mockCampaign], null]);

      const res = await request(app).get(`/api/campaigns/${mockCampaign.id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(mockCampaign.id);
    });
  });
});
