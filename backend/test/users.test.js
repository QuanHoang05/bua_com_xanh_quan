// backend/test/users.test.js
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
jest.unstable_mockModule("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));
jest.unstable_mockModule("bcrypt", () => ({
  __esModule: true,
  default: { hash: jest.fn(), compare: jest.fn() },
}));

const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
};

describe.each([
  { driver: "sqlite", dbModulePath: "../src/lib/db.js" },
  { driver: "mysql", dbModulePath: "../src/lib/db.mysql.js" },
])("User Routes with $driver DB", ({ driver, dbModulePath }) => {
  const mockUser = {
    id: "user-123",
    email: "user@test.com",
    name: "Test User",
    role: "user",
  };
  const userToken = signTestToken(mockUser);
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

    const { default: usersRouter } = await import("../src/routes/users.js");
    app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
  });

  beforeEach(() => {
    mockDbFunctions.run.mockClear();
    mockDbFunctions.get.mockClear();
    mockDbFunctions.all.mockClear();
    mockDbFunctions.query.mockClear();
  });

  test("GET /me should return user profile", async () => {
    mockDbFunctions.get.mockResolvedValue(mockUser);

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(mockUser.id);
    expect(mockDbFunctions.get).toHaveBeenCalledTimes(1);
  });

  test("PATCH /me should update and return user profile", async () => {
    const updatedData = { name: "Updated Name", address: "New Address" };
    const updatedUser = { ...mockUser, ...updatedData };

    mockDbFunctions.run.mockResolvedValue({ changes: 1, affectedRows: 1 });
    mockDbFunctions.get.mockResolvedValue(updatedUser);

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send(updatedData);

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Updated Name");
  });

  test("POST /delete should mark user as deleted", async () => {
    mockDbFunctions.run.mockResolvedValue({ changes: 1, affectedRows: 1 });

    const res = await request(app)
      .post("/api/users/delete")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDbFunctions.run).toHaveBeenCalledTimes(2);
  });
});
