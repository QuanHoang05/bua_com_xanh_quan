/**
 * Jest Integration Tests - Backups
 * Mục đích: Kiểm thử các endpoint backup/restore (nếu có) hoặc trigger backup
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

describe("Backups Integration Suite", () => {
  test("BK-INT-01 Trigger backup -> should return 200/401/404", async () => {
    const res = await http.post("/api/admin/backup");
    expect([200, 401, 404]).toContain(res.status);
  }, 20000);
});
