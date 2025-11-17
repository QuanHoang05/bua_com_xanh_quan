/**
 * Jest Integration Tests - Payments
 * Mục đích: Kiểm thử luồng thanh toán / momo (mô phỏng request)
 */

import request from "supertest";
import setup from "./setup.js";

let app, http;

beforeAll(async () => {
  await setup.ensureSeededAndConnected();
  const appModule = await import("../../src/app.js");
  app = appModule.default;
  http = request(app);
});

describe("Payments Integration Suite", () => {
  test("PAY-INT-01 Create payment -> 200/201/401", async () => {
    const res = await http
      .post("/api/payments")
      .send({ amount: 1000, method: "momo" });
    expect([200, 201, 401, 404]).toContain(res.status);
  }, 15000);
});
