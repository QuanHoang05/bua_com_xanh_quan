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

// Mock DBs
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
    run: jest.fn(),
  },
}));

const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
};

describe("User Routes (/api/users)", () => {
  const mockUser = {
    id: "user-123",
    email: "user@test.com",
    name: "Test User",
    role: "user",
  };
  const userToken = signTestToken(mockUser);

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

      const { default: usersRouter } = await import("../src/routes/users.js");
      const dbModule = await import("../src/lib/db.js");
      sqliteDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/users", usersRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy thông tin cá nhân của người dùng đang đăng nhập.
    test("GET /me should return user profile", async () => {
      const getMock = jest.fn().mockReturnValue(mockUser);
      sqliteDb.prepare.mockReturnValue({ get: getMock });

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(mockUser.id);
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    // Kiểm tra chức năng cho phép người dùng tự cập nhật thông tin cá nhân.
    test("PATCH /me should update and return user profile", async () => {
      const updatedData = { name: "Updated Name", address: "New Address" };
      const updatedUser = { ...mockUser, ...updatedData };

      sqliteDb.prepare
        .mockReturnValueOnce({ run: jest.fn().mockReturnValue({ changes: 1 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue(updatedUser) });

      const res = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updatedData);

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    // Kiểm tra chức năng cho phép người dùng tự xóa tài khoản của mình.
    test("POST /delete should mark user as deleted", async () => {
      const runMock = jest.fn().mockReturnValue({ changes: 1 });
      sqliteDb.prepare.mockReturnValue({ run: runMock });

      const res = await request(app)
        .post("/api/users/delete")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(runMock).toHaveBeenCalledTimes(2);
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

      const { default: usersRouter } = await import("../src/routes/users.js");
      const dbModule = await import("../src/lib/db.mysql.js");
      mysqlDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api/users", usersRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra chức năng lấy thông tin cá nhân của người dùng đang đăng nhập.
    test("GET /me should return user profile", async () => {
      mysqlDb.get.mockResolvedValue(mockUser);

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(mockUser.id);
    });

    // Kiểm tra chức năng cho phép người dùng tự cập nhật thông tin cá nhân.
    test("PATCH /me should update and return user profile", async () => {
      const updatedData = { name: "Updated Name MySQL", phone: "012345" };
      const updatedUser = { ...mockUser, ...updatedData };

      mysqlDb.run.mockResolvedValueOnce({ affectedRows: 1 });
      mysqlDb.get.mockResolvedValueOnce(updatedUser);

      const res = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${userToken}`)
        .send(updatedData);

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe("Updated Name MySQL");
    });

    // Kiểm tra chức năng cho phép người dùng tự xóa tài khoản của mình.
    test("POST /delete should mark user as deleted", async () => {
      mysqlDb.run.mockResolvedValue({ affectedRows: 1 });

      const res = await request(app)
        .post("/api/users/delete")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mysqlDb.run).toHaveBeenCalledTimes(2);
    });
  });
});
