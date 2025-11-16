// backend/test/auth.test.js
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

// --- GIẢ LẬP (MOCK) CÁC MODULES ---
// Giả lập nodemailer để không gửi email thật trong quá trình test
jest.unstable_mockModule("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Giả lập bcrypt để không thực hiện hash/compare mật khẩu thật, giúp test nhanh hơn
jest.unstable_mockModule("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn().mockResolvedValue("hashed_password_mock"),
    compare: jest.fn((plain, hash) =>
      Promise.resolve(
        plain === "password123" && hash === "hashed_password_mock"
      )
    ),
  },
}));

// Giả lập các module DB
jest.unstable_mockModule("../src/lib/db.js", () => ({
  db: {
    prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })),
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

// Hàm tiện ích tạo token JWT giả
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
};

// Import bcrypt để sử dụng trong tests
let bcrypt;
try {
  const bcryptModule = await import("bcrypt");
  bcrypt = bcryptModule.default;
} catch (e) {
  // Fallback: tạo mock nếu import thất bại
  bcrypt = {
    hash: jest.fn().mockResolvedValue("hashed_password_mock"),
    compare: jest.fn((plain, hash) =>
      Promise.resolve(
        plain === "password123" && hash === "hashed_password_mock"
      )
    ),
  };
}

// Mô tả bộ test cho các route xác thực người dùng
describe("Auth Routes", () => {
  // ==================================
  // BỘ TEST VỚI MÔI TRƯỜNG SQLITE
  // ==================================
  describe("with SQLite DB", () => {
    let app;
    let sqliteDb;

    // Cài đặt môi trường test cho SQLite
    beforeAll(async () => {
      process.env.DB_DRIVER = "sqlite";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const authModule = await import("../src/routes/auth.js");
      const dbModule = await import("../src/lib/db.js");

      sqliteDb = dbModule.db;
      app = express();
      app.use(express.json());
      app.use("/api/auth", authModule.authRouter);
    });

    // Reset các mock trước mỗi test
    beforeEach(() => {
      jest.clearAllMocks();
      sqliteDb.prepare.mockImplementation(() => ({
        get: jest.fn(),
        run: jest.fn(),
        all: jest.fn(),
      }));
      bcrypt.compare.mockImplementation((plain, hash) =>
        Promise.resolve(
          plain === "password123" && hash === "hashed_password_mock"
        )
      );
    });

    // --- Test Đăng Ký ---
    test("POST /register - Thành công với thông tin hợp lệ", async () => {
      // Giả lập DB: user chưa tồn tại, insert thành công, sau đó lấy lại user đã tạo
      sqliteDb.prepare
        .mockReturnValueOnce({ get: () => null }) // user not existed
        .mockReturnValueOnce({ run: () => ({ changes: 1 }) }) // insert ok
        .mockReturnValueOnce({
          get: () => ({
            id: "123",
            email: "test@example.com",
            name: "SQLite User",
            role: "user",
          }),
        }); // get user ok

      const res = await request(app).post("/api/auth/register").send({
        name: "SQLite User",
        email: "test@example.com",
        password: "password123",
        address: "HN",
      });

      expect(res.statusCode).toBe(201); // 201 Created
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    test("POST /register - Thất bại do thiếu trường thông tin", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "password123",
        address: "HN", // Thiếu 'name'
      });
      expect(res.statusCode).toBe(400); // 400 Bad Request
      expect(res.body.message).toBe("Thiếu thông tin");
    });

    test("POST /register - Thất bại do email đã tồn tại", async () => {
      // Giả lập DB tìm thấy user với email này
      sqliteDb.prepare.mockReturnValueOnce({ get: () => ({ id: "123" }) }); // user exists

      const res = await request(app).post("/api/auth/register").send({
        name: "SQLite User",
        email: "test@example.com",
        password: "password123",
        address: "HN",
      });
      expect(res.statusCode).toBe(409); // 409 Conflict
      expect(res.body.message).toBe("Email đã tồn tại");
    });

    // --- Test Đăng Nhập ---
    test("POST /login - Thành công với email và mật khẩu đúng", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        status: "active",
        password_hash: "hashed_password_mock",
      };
      // Giả lập DB tìm thấy user
      sqliteDb.prepare.mockReturnValueOnce({ get: () => mockUser });

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    test("POST /login - Thất bại do email không tồn tại", async () => {
      // Giả lập DB không tìm thấy user
      sqliteDb.prepare.mockReturnValueOnce({ get: () => null });

      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(401); // 401 Unauthorized
      expect(res.body.message).toBe("Sai email hoặc mật khẩu");
    });

    test("POST /login - Thất bại do sai mật khẩu", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        status: "active",
        password_hash: "wrong_hashed_password",
      };
      // Giả lập DB tìm thấy user, nhưng bcrypt.compare sẽ trả về false
      sqliteDb.prepare.mockReturnValueOnce({ get: () => mockUser });
      bcrypt.compare.mockImplementationOnce(() => Promise.resolve(false));

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sai email hoặc mật khẩu");
    });

    test("POST /login - Thất bại do tài khoản chưa kích hoạt", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        status: "inactive",
        password_hash: "hashed_password_mock",
      };
      // Giả lập DB tìm thấy user nhưng status là 'inactive'
      sqliteDb.prepare.mockReturnValueOnce({ get: () => mockUser });
      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(403); // 403 Forbidden
      expect(res.body.message).toBe("Tài khoản chưa được phép đăng nhập");
    });

    // --- Test Đăng Xuất ---
    test("POST /logout - Đăng xuất thành công", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // --- Test Lấy Thông Tin User (/me) ---
    test("GET /me - Thành công với token hợp lệ", async () => {
      const user = { id: "123", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB tìm thấy user từ token payload
      sqliteDb.prepare.mockReturnValueOnce({
        get: () => ({ ...user, name: "Test User" }),
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.id).toBe("123");
    });

    test("GET /me - Thất bại với token không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid token");
    });

    test("GET /me - Thất bại do user trong token không tồn tại trong DB", async () => {
      const user = { id: "123", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB không tìm thấy user
      sqliteDb.prepare.mockReturnValueOnce({ get: () => null });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404); // 404 Not Found
      expect(res.body.message).toBe("User not found");
    });

    // --- Test Đổi Mật Khẩu ---
    test("POST /change-password - Đổi mật khẩu thành công", async () => {
      const user = { id: "123", email: "test@example.com", role: "user" };
      const token = signTestToken(user);

      // Giả lập DB: tìm thấy user, sau đó update thành công
      sqliteDb.prepare
        .mockReturnValueOnce({
          get: () => ({
            id: "123",
            email: "test@example.com",
            name: "Test User",
          }),
        })
        .mockReturnValueOnce({ run: () => ({ changes: 1 }) });

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "newpassword123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test("POST /change-password - Thất bại do mật khẩu mới quá ngắn", async () => {
      const user = { id: "123", email: "test@example.com", role: "user" };
      const token = signTestToken(user);

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "short" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Mật khẩu tối thiểu 8 ký tự");
    });

    test("POST /change-password - Thất bại do user không tồn tại", async () => {
      const user = { id: "123", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB không tìm thấy user
      sqliteDb.prepare.mockReturnValueOnce({ get: () => null });

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "newpassword123" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });
  });

  // =================================
  // BỘ TEST VỚI MÔI TRƯỜNG MYSQL
  // =================================
  describe("with MySQL DB", () => {
    let app;
    let mysqlDb;

    // Cài đặt môi trường test cho MySQL
    beforeAll(async () => {
      process.env.DB_DRIVER = "mysql";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const authModule = await import("../src/routes/auth.js");
      const dbModule = await import("../src/lib/db.mysql.js");

      mysqlDb = dbModule.db;
      app = express();
      app.use(express.json());
      app.use("/api/auth", authModule.authRouter);
    });

    // Reset các mock trước mỗi test
    beforeEach(() => {
      jest.clearAllMocks();
      mysqlDb.get.mockReset().mockResolvedValue(null);
      mysqlDb.all.mockReset().mockResolvedValue([]);
      mysqlDb.run.mockReset().mockResolvedValue({});
      mysqlDb.query.mockReset().mockResolvedValue([[]]);
      bcrypt.compare.mockImplementation((plain, hash) =>
        Promise.resolve(
          plain === "password123" && hash === "hashed_password_mock"
        )
      );
    });

    // --- Test Đăng Ký ---
    test("POST /register - Thành công với thông tin hợp lệ", async () => {
      // Giả lập DB: user chưa tồn tại, insert thành công, sau đó lấy lại user đã tạo
      mysqlDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "456",
        email: "mysql@example.com",
        name: "MySQL User",
        role: "user",
      });
      mysqlDb.run.mockResolvedValueOnce({ affectedRows: 1 });

      const res = await request(app).post("/api/auth/register").send({
        name: "MySQL User",
        email: "mysql@example.com",
        password: "password123",
        address: "HCM",
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    test("POST /register - Thất bại do thiếu trường thông tin", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "password123",
        address: "HCM", // Thiếu 'name'
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Thiếu thông tin");
    });

    test("POST /register - Thất bại do email đã tồn tại", async () => {
      // Giả lập DB tìm thấy user với email này
      mysqlDb.get.mockResolvedValueOnce({ id: "456" }); // user exists

      const res = await request(app).post("/api/auth/register").send({
        name: "MySQL User",
        email: "mysql@example.com",
        password: "password123",
        address: "HCM",
      });
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Email đã tồn tại");
    });

    // --- Test Đăng Nhập ---
    test("POST /login - Thành công với email và mật khẩu đúng", async () => {
      const mockUser = {
        id: "456",
        email: "mysql@example.com",
        status: "active",
        password_hash: "hashed_password_mock",
      };
      // Giả lập DB tìm thấy user
      mysqlDb.get.mockResolvedValueOnce(mockUser);

      const res = await request(app).post("/api/auth/login").send({
        email: "mysql@example.com",
        password: "password123",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
    });

    test("POST /login - Thất bại do email không tồn tại", async () => {
      // Giả lập DB không tìm thấy user
      mysqlDb.get.mockResolvedValueOnce(null);

      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sai email hoặc mật khẩu");
    });

    test("POST /login - Thất bại do sai mật khẩu", async () => {
      const mockUser = {
        id: "456",
        email: "mysql@example.com",
        status: "active",
        password_hash: "wrong_hashed_password",
      };
      // Giả lập DB tìm thấy user, nhưng bcrypt.compare sẽ trả về false
      mysqlDb.get.mockResolvedValueOnce(mockUser);
      bcrypt.compare.mockImplementationOnce(() => Promise.resolve(false));

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Sai email hoặc mật khẩu");
    });

    test("POST /login - Thất bại do tài khoản chưa kích hoạt", async () => {
      const mockUser = {
        id: "456",
        email: "mysql@example.com",
        status: "inactive",
        password_hash: "hashed_password_mock",
      };
      // Giả lập DB tìm thấy user nhưng status là 'inactive'
      mysqlDb.get.mockResolvedValueOnce(mockUser);

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Tài khoản chưa được phép đăng nhập");
    });

    // --- Test Đăng Xuất ---
    test("POST /logout - Đăng xuất thành công", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // --- Test Lấy Thông Tin User (/me) ---
    test("GET /me - Thành công với token hợp lệ", async () => {
      const user = { id: "456", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB tìm thấy user từ token payload
      mysqlDb.get.mockResolvedValueOnce({ ...user, name: "Test User" });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.id).toBe("456");
    });

    test("GET /me - Thất bại với token không hợp lệ", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalidtoken");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid token");
    });

    test("GET /me - Thất bại do user trong token không tồn tại trong DB", async () => {
      const user = { id: "456", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB không tìm thấy user
      mysqlDb.get.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    // --- Test Đổi Mật Khẩu ---
    test("POST /change-password - Đổi mật khẩu thành công", async () => {
      const user = { id: "456", email: "test@example.com", role: "user" };
      const token = signTestToken(user);

      // Giả lập DB: tìm thấy user, sau đó update thành công
      mysqlDb.get.mockResolvedValueOnce({
        id: "456",
        email: "mysql@example.com",
        name: "MySQL User",
      });
      mysqlDb.run.mockResolvedValueOnce({ affectedRows: 1 });

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "newpassword123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test("POST /change-password - Thất bại do mật khẩu mới quá ngắn", async () => {
      const user = { id: "456", email: "test@example.com", role: "user" };
      const token = signTestToken(user);

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "short" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Mật khẩu tối thiểu 8 ký tự");
    });

    test("POST /change-password - Thất bại do user không tồn tại", async () => {
      const user = { id: "456", email: "test@example.com", role: "user" };
      const token = signTestToken(user);
      // Giả lập DB không tìm thấy user
      mysqlDb.get.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ new_password: "newpassword123" });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });
  });
});
