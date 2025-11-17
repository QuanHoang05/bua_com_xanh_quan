/**
 * Jest Integration Tests - Authentication
 * Mục đích: Chạy các test authentication trên database thật (MySQL)
 * Lưu ý: biến môi trường DB_* cần được cấu hình trước khi chạy (ví dụ CI hoặc .env.test)
 */

import request from "supertest";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tải app (sử dụng môi trường test và DB thật)
 */
let app;
let http;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DB_DRIVER = process.env.DB_DRIVER || "mysql";
  // import app module
  const appModule = await import("../../src/app.js");
  app = appModule.default;
  http = request(app);
});

describe("Authentication Integration Suite", () => {
  test("AUTH-INT-01 Register -> should create user and return token", async () => {
    const email = `auth.jest.${Date.now()}@example.com`;
    const payload = {
      name: "Jest Integration User",
      email,
      password: "TestPass123!@",
    };

    const res = await http.post("/api/auth/register").send(payload);
    expect([201, 200]).toContain(res.status);
    expect(res.body).toHaveProperty("token");
  }, 20000);

  test("AUTH-INT-02 Login -> should return token for registered user", async () => {
    const email = `auth.jest.${Date.now()}@example.com`;
    const registerRes = await http.post("/api/auth/register").send({
      name: "Jest Login User",
      email,
      password: "Login123!@",
    });
    expect(registerRes.body).toHaveProperty("token");

    const loginRes = await http
      .post("/api/auth/login")
      .send({ email, password: "Login123!@" });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
  }, 20000);
});
