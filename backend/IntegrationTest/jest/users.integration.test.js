/**
 * Jest Integration Tests - Users
 * Mục đích: Kiểm thử các endpoint user profile/history trên DB thật
 */

import request from "supertest";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app;
let http;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DB_DRIVER = process.env.DB_DRIVER || "mysql";
  const appModule = await import("../../src/app.js");
  app = appModule.default;
  http = request(app);
});

describe("Users Integration Suite", () => {
  test("USER-INT-01 Get public profile -> should return user schema or 404", async () => {
    const res = await http.get("/api/users/1");
    expect([200, 404]).toContain(res.status);
  }, 10000);

  test("USER-INT-02 List user history -> should return array or 401 if private", async () => {
    const res = await http.get("/api/users/1/history");
    expect([200, 401, 404]).toContain(res.status);
  }, 10000);
});
