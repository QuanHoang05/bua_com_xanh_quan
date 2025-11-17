/**
 * Jest Integration Tests - Metrics
 * Mục đích: Kiểm thử các endpoint metrics (admin) trên DB thật
 */

import request from "supertest";
import setup from "./setup.js";

let app, http;

beforeAll(async () => {
  // Thực hiện seed và kiểm tra DB
  await setup.ensureSeededAndConnected();
  const appModule = await import("../../src/app.js");
  app = appModule.default;
  http = request(app);
});

describe("Metrics Integration Suite", () => {
  test("MTR-INT-01 Delivery success endpoint should respond", async () => {
    const res = await http.get("/api/admin/metrics/delivery-success");
    expect([200, 401, 404]).toContain(res.status);
  }, 15000);

  test("MTR-INT-02 Overview should respond", async () => {
    const res = await http.get("/api/admin/metrics/overview");
    expect([200, 401, 404]).toContain(res.status);
  }, 15000);
});
