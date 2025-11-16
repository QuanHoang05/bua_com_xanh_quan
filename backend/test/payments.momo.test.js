// backend/test/payments.momo.test.js
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
import crypto from "crypto";
import jwt from "jsonwebtoken";

// --- MOCK MODULES ---
// Mô phỏng database MySQL
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    query: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  },
}));

jest.unstable_mockModule("../src/lib/db.js", () => ({
  db: { prepare: jest.fn(() => ({})) },
}));

// Mô phỏng module fetch
jest.unstable_mockModule("node-fetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mô phỏng middleware auth để lấy user từ JWT
jest.unstable_mockModule("../src/routes/auth.js", () => ({
  requireAuth: (req, res, next) => {
    try {
      const token = (req.headers.authorization || "").slice(7);
      const payload = jwt.verify(token, "test_secret");
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  },
}));

// --- HÀM HỖ TRỢ ---
// Tạo chữ ký HMAC SHA256
function hmacSHA256(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// Chuyển giá trị null/undefined thành string an toàn
const safe = (v) => (v == null ? "" : String(v));

// Tạo raw signature IPN của Momo
function buildIpnRawSig(accessKey, body) {
  const b = body || {};
  return (
    `accessKey=${accessKey}` +
    `&amount=${safe(b.amount)}` +
    `&extraData=${safe(b.extraData)}` +
    `&message=${safe(b.message)}` +
    `&orderId=${safe(b.orderId)}` +
    `&orderInfo=${safe(b.orderInfo)}` +
    `&orderType=${safe(b.orderType)}` +
    `&partnerCode=${safe(b.partnerCode)}` +
    `&payType=${safe(b.payType)}` +
    `&requestId=${safe(b.requestId)}` +
    `&responseTime=${safe(b.responseTime)}` +
    `&resultCode=${safe(b.resultCode)}` +
    `&transId=${safe(b.transId)}`
  );
}

// ===== TEST ROUTES Momo =====
describe("Momo Payment Routes (/api/payments/momo)", () => {
  let app;
  let mysqlDb;
  let fetchMock;
  const testUser = {
    id: "user-123",
    name: "Test User",
    email: "user@test.com",
  };
  const testToken = jwt.sign(testUser, "test_secret", { expiresIn: "1d" });

  beforeAll(async () => {
    // Thiết lập biến môi trường
    process.env.DB_DRIVER = "mysql";
    process.env.JWT_SECRET = "test_secret";
    process.env.MOMO_PARTNER_CODE = "MOMO";
    process.env.MOMO_ACCESS_KEY = "test_access_key";
    process.env.MOMO_SECRET_KEY = "test_secret_key";
    process.env.MOMO_REDIRECT_URL = "http://localhost/return";
    process.env.MOMO_IPN_URL = "http://localhost/ipn";
    process.env.PAYMENTS_FORCE_MOCK = "1";

    jest.resetModules();

    // Import routes Momo
    const momoRoutes = await import("../src/routes/payments.momo.js");
    const fetchModule = await import("node-fetch");
    const dbModule = await import("../src/lib/db.mysql.js");

    mysqlDb = dbModule.db;
    fetchMock = fetchModule.default;

    // Tạo app Express test route
    app = express();
    app.use(express.json());
    app.use("/api/payments/momo", momoRoutes.default);
  });

  beforeEach(() => {
    // Reset mocks trước mỗi test
    jest.clearAllMocks();
    fetchMock.mockClear();
    mysqlDb.query.mockReset();
    mysqlDb.query.mockResolvedValue([[], null]);
  });

  // --- Test: Tạo yêu cầu thanh toán Momo ---
  test("POST /create should create a Momo payment request", async () => {
    const paymentData = {
      amount: 50000,
      orderInfo: "Ủng hộ chiến dịch ABC",
      campaign_id: "camp-123",
    };

    // Mô phỏng insert vào DB
    mysqlDb.query.mockResolvedValueOnce([{ insertId: 1 }, null]);

    const res = await request(app)
      .post("/api/payments/momo/create")
      .set("Authorization", `Bearer ${testToken}`)
      .send(paymentData);

    // Kỳ vọng: trả về mock URL vì PAYMENTS_FORCE_MOCK=1
    expect(res.statusCode).toBe(200);
    expect(res.body.payUrl).toMatch(/^\/mock-momo\/MOMO\d+$/);
    expect(res.body.mock).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // Khi dùng mock
    expect(mysqlDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO donations"),
      expect.any(Array)
    );
  });

  // --- Test: Xử lý callback IPN từ Momo ---
  test("POST /ipn should handle Momo IPN and update transaction status", async () => {
    const momoCallbackData = {
      partnerCode: "MOMO",
      orderId: "order-123",
      requestId: "req-123",
      amount: 50000,
      orderInfo: "test transaction",
      orderType: "momo_wallet",
      transId: "trans-456",
      resultCode: 0,
      message: "Success",
      payType: "qr",
      responseTime: Date.now(),
      extraData: "",
      bankCode: null,
    };

    // Tạo chữ ký IPN
    const rawSig = buildIpnRawSig(
      process.env.MOMO_ACCESS_KEY,
      momoCallbackData
    );
    momoCallbackData.signature = hmacSHA256(
      process.env.MOMO_SECRET_KEY,
      rawSig
    );

    // Mô phỏng DB select và update
    mysqlDb.query.mockImplementation(async (sql, params) => {
      if (sql.includes("SELECT id, status FROM donations WHERE order_id = ?")) {
        return [[{ id: 1, status: "pending" }], null];
      }
      if (sql.includes("UPDATE donations")) {
        return [[{ affectedRows: 1 }], null];
      }
      return [[], null];
    });

    const res = await request(app)
      .post("/api/payments/momo/ipn")
      .send(momoCallbackData);

    expect(res.statusCode).toBe(204); // Kỳ vọng không trả body
    expect(mysqlDb.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "SELECT id, status FROM donations WHERE order_id = ?"
      ),
      [momoCallbackData.orderId]
    );
    // Check that update was called with correct query structure
    expect(mysqlDb.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE donations"),
      expect.arrayContaining([momoCallbackData.orderId])
    );
  });
});
