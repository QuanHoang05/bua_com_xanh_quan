// backend/test/recipients.test.js
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
import jwt from "jsonwebtoken";

// Mock database modules
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    query: jest.fn(),
    all: jest.fn(),
    get: jest.fn(),
  },
}));

jest.unstable_mockModule("../src/lib/db.js", () => ({ db: {} }));

// Mock requireAuth middleware
jest.unstable_mockModule("../src/middlewares/auth.js", () => ({
  requireAuth: (req, res, next) => {
    try {
      const token = (req.headers.authorization || "").slice(7);
      const payload = jwt.verify(token, "test_secret");
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  },
}));

describe("Recipient Routes (/api/recipients)", () => {
  let app;
  let mysqlDb;

  beforeAll(async () => {
    process.env.DB_DRIVER = "mysql";
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();

    const { default: recipientsRouter } = await import(
      "../src/routes/recipients.js"
    );
    const dbModule = await import("../src/lib/db.mysql.js");
    mysqlDb = dbModule.db;

    app = express();
    app.use(express.json());
    app.use("/api/recipients", recipientsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Kiểm tra chức năng lấy danh sách tất cả người nhận.
  test("GET / should return a list of all recipients", async () => {
    const mockRecipients = [
      { id: "rec-1", name: "Recipient One", role: "receiver" },
      { id: "rec-2", name: "Recipient Two", role: "receiver" },
    ];
    const testUser = { id: "user-123", role: "admin" };
    const testToken = jwt.sign(testUser, "test_secret", { expiresIn: "1d" });

    // Mock the query - GET / calls dbAll which calls db.query
    mysqlDb.query.mockResolvedValueOnce([mockRecipients, null]);

    const res = await request(app)
      .get("/api/recipients/")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toEqual(mockRecipients);
  });
});
