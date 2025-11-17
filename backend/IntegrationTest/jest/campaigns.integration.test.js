/**
 * Jest Integration Tests - Campaigns
 * Mục đích: Kiểm thử các endpoint liên quan đến campaign trên DB thật
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

describe("Campaigns Integration Suite", () => {
  test("CAMP-INT-01 List campaigns -> should return array", async () => {
    const res = await http.get("/api/campaigns");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  }, 15000);

  test("CAMP-INT-02 Search campaign -> should support filters", async () => {
    const res = await http.get("/api/campaigns?search=food");
    expect([200, 204]).toContain(res.status);
  }, 15000);
});
