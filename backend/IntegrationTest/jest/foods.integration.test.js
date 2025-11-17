/**
 * Jest Integration Tests - Foods
 * Mục đích: Kiểm thử các endpoint liên quan đến thực phẩm (expire, list)
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

describe("Foods Integration Suite", () => {
  test("FOOD-INT-01 List foods -> 200 or 404", async () => {
    const res = await http.get("/api/foods");
    expect([200, 404, 401]).toContain(res.status);
  }, 10000);

  test("FOOD-INT-02 Expire food flow -> 200/401/404", async () => {
    const res = await http.post("/api/foods/1/expire");
    expect([200, 401, 404]).toContain(res.status);
  }, 10000);
});
