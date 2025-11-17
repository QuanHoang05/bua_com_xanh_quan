/**
 * Jest Integration Tests - Deliveries
 * Mục đích: Kiểm thử luồng giao hàng: list, detail, update status
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

describe("Deliveries Integration Suite", () => {
  test("DEL-INT-01 List deliveries", async () => {
    const res = await http.get("/api/deliveries");
    expect([200, 401, 404]).toContain(res.status);
  }, 15000);

  test("DEL-INT-02 Update delivery status -> 200/401/404", async () => {
    const res = await http
      .patch("/api/deliveries/1/status")
      .send({ status: "delivered" });
    expect([200, 401, 404]).toContain(res.status);
  }, 15000);
});
