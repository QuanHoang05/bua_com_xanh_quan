// testAPIreal/auth.test.js
import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import app from "../src/app.js"; // Import Express app
import { seedData } from "./dbHelper.js";
import bcrypt from "bcrypt";

// Mô tả bộ test cho các API xác thực người dùng
describe("API Xác thực - /api/auth", () => {
  let server;

  // Khởi động server trước khi chạy các test trong file này
  beforeAll(() => {
    server = app.listen(process.env.PORT);
  });

  // Đóng server sau khi chạy xong
  afterAll((done) => {
    server.close(done);
  });

  // --- BÀI TEST 1: ĐĂNG KÝ TÀI KHOẢN MỚI ---
  describe("POST /api/auth/register", () => {
    test("Nên tạo người dùng mới thành công và trả về token", async () => {
      console.log("--- Bắt đầu test: Đăng ký người dùng mới ---");
      const newUser = {
        name: "Người Dùng Test",
        email: "test.user@example.com",
        password: "password123",
        address: "123 Đường Test, Quận Test, TP. Test",
      };

      try {
        const res = await request(server).post("/api/auth/register").send(newUser);

        // 1. Kiểm tra HTTP status code
        expect(res.statusCode).toBe(201);

        // 2. Kiểm tra cấu trúc response body
        expect(res.body).toHaveProperty("user");
        expect(res.body).toHaveProperty("token");

        // 3. Kiểm tra thông tin người dùng trả về
        expect(res.body.user.email).toBe(newUser.email);
        expect(res.body.user.name).toBe(newUser.name);

        // 4. Kiểm tra token không được rỗng
        expect(res.body.token).not.toBeNull();
        expect(res.body.token.length).toBeGreaterThan(20);

        console.log("✅ Test đăng ký thành công!");
      } catch (error) {
        console.error("❌ Lỗi khi test đăng ký:", error.message);
        throw error; // Ném lỗi để Jest biết test thất bại
      }
    });
  });

  // --- BÀI TEST 2: ĐĂNG NHẬP VỚI TÀI KHOẢN ĐÃ TỒN TẠI ---
  describe("POST /api/auth/login", () => {
    // Chuẩn bị dữ liệu: tạo một người dùng trong CSDL trước khi test đăng nhập
    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash("password_login", 10);
      await seedData("users", [
        {
          id: "user-login-test",
          email: "login.user@example.com",
          password_hash: hashedPassword,
          name: "Login Test User",
          role: "user",
          status: "active",
        },
      ]);
    });

    test("Nên đăng nhập thành công và trả về token", async () => {
      console.log("--- Bắt đầu test: Đăng nhập ---");
      const loginCredentials = {
        email: "login.user@example.com",
        password: "password_login",
      };

      const res = await request(server).post("/api/auth/login").send(loginCredentials);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(loginCredentials.email);
      console.log("✅ Test đăng nhập thành công!");
    });
  });
});