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

// --- MOCK MODULES ---
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    query: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  },
}));

jest.unstable_mockModule("../src/lib/db.js", () => ({ db: {} }));

describe("Donor Routes (/api/donors)", () => {
  let app;
  let mysqlDb;
  const donorUser = { id: "donor-123", role: "donor" };
  const donorToken = jwt.sign(donorUser, "test_secret", { expiresIn: "1d" });

  beforeAll(async () => {
    process.env.DB_DRIVER = "mysql";
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();

    const { default: donorsRouter } = await import("../src/routes/donors.js");
    const dbModule = await import("../src/lib/db.mysql.js");
    mysqlDb = dbModule.db;

    app = express();
    app.use(express.json());
    app.use("/api/donors", donorsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /donations should return the donation history for the authenticated donor", async () => {
    const mockUser = {
      ...donorUser,
      name: "Test Donor",
      email: "donor@test.com",
      avatar_url: null,
      address: "123 Test St",
      status: "active",
      phone: "0123456789",
    };
    const mockDonationHistory = [{ id: 1, amount: 10000, status: "success" }];

    // Mock implementation to handle different queries
    mysqlDb.query.mockImplementation(async (sql, params) => {
      if (
        sql.includes(
          "SELECT id,name,email,avatar_url,address,status,phone FROM users WHERE id=?"
        )
      ) {
        return [[mockUser]];
      }
      if (sql.includes("FROM donations")) {
        return [mockDonationHistory];
      }
      return [[]];
    });

    const res = await request(app)
      .get("/api/donors/donations")
      .set("Authorization", `Bearer ${donorToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(expect.any(Array));

    //Kiểm tra xem middleware tra cứu thông tin người dùng đã được gọi chưa
    expect(mysqlDb.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "SELECT id,name,email,avatar_url,address,status,phone FROM users WHERE id=?"
      ),
      [donorUser.id]
    );
  });
});
