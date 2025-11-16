// backend/test/webhooks.vietqr.test.js
import {
  jest,
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import request from "supertest";
import express from "express";

// Force DB driver to mysql before importing/mocking modules
process.env.DB_DRIVER = "mysql";

// Mock the database module that the route will import
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: { get: jest.fn(), all: jest.fn(), run: jest.fn(), query: jest.fn() },
}));

const { default: vietqrWebhookRouter } = await import(
  "../src/routes/webhooks.vietqr.js"
);
const { db: mysqlDb } = await import("../src/lib/db.mysql.js");

const app = express();
app.use(express.json());
// The webhook router is mounted at /api/webhooks in server.js, and the route itself is /bank/vietqr
// So the full path is /api/webhooks/bank/vietqr
app.use("/api/webhooks", vietqrWebhookRouter);

describe("VietQR Webhook Route (/api/webhooks/bank/vietqr)", () => {
  beforeAll(() => {
    // already set at module top; keep for clarity
    process.env.DB_DRIVER = "mysql";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Kiểm tra chức năng xử lý một giao dịch hợp lệ từ webhook của VietQR.
  test("POST /bank/vietqr should process a valid transaction and update the database", async () => {
    const webhookData = {
      bank_txn_id: "vietqr-trans-1",
      amount: 70000,
      memo: "BXA#12345 Ung ho",
      paid_at: new Date().toISOString(),
    };

    mysqlDb.all.mockResolvedValue([]); // Mock the INSERT IGNORE and UPDATE calls

    const res = await request(app)
      .post("/api/webhooks/bank/vietqr")
      .send(webhookData);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // Check that both the donation insert and campaign update were called
    expect(mysqlDb.all).toHaveBeenCalledTimes(2);
  });

  // Kiểm tra payload không hợp lệ.
  test("POST /bank/vietqr should return 422 for invalid payload", async () => {
    const webhookData = {
      // Missing bank_txn_id and amount
      memo: "Some memo",
    };

    const res = await request(app)
      .post("/api/webhooks/bank/vietqr")
      .send(webhookData);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe("invalid_payload");
  });
});
