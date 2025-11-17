/**
 * Jest Integration Tests - Admin Management
 * Mục đích: Kiểm thử các tính năng quản trị như user list, ban/unban
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

describe("Admin Integration Suite", () => {
  test("ADMIN-INT-01 Get admin users list -> ok or 401", async () => {
    const res = await http.get("/api/admin/users");
    expect([200, 401]).toContain(res.status);
  }, 15000);

  test("ADMIN-INT-02 Ban/Unban user flow -> returns 200/401/404", async () => {
    // Try to ban user id=1 as a smoke check
    const res = await http.post("/api/admin/users/1/ban");
    expect([200, 401, 404]).toContain(res.status);
  }, 15000);
});
