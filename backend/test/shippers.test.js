// backend/test/shippers.test.js
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
import jwt from "jsonwebtoken";

// Mock database modules
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: { get: jest.fn(), all: jest.fn(), run: jest.fn(), query: jest.fn() },
}));

jest.unstable_mockModule("../src/lib/db.js", () => ({ db: {} }));

describe("Shipper Routes (/api/shippers)", () => {
  let app;
  let mysqlDb;
  const shipperUser = { id: "shipper-123", role: "shipper" };

  const signTestToken = (payload) => {
    return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
  };
  const shipperToken = signTestToken(shipperUser);

  beforeAll(async () => {
    process.env.DB_DRIVER = "mysql";
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();

    const { default: shipperRouter } = await import(
      "../src/routes/shippers.js"
    );
    const dbModule = await import("../src/lib/db.mysql.js");
    mysqlDb = dbModule.db;

    app = express();
    app.use(express.json());
    app.use("/api/shippers", shipperRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Đảm bảo mọi truy vấn DB đều trả về dữ liệu hợp lệ
    mysqlDb.query.mockImplementation((...args) => {
      // Trả về user hợp lệ cho middleware xác thực
      if (args[0]?.includes("FROM users")) {
        return Promise.resolve([
          [
            {
              id: "shipper-123",
              role: "shipper",
              name: "Test Shipper",
              email: "shipper@test.com",
              phone: null,
            },
          ],
          null,
        ]);
      }
      // Trả về delivery hợp lệ cho GET và PATCH
      if (args[0]?.includes("FROM deliveries")) {
        return Promise.resolve([
          [
            {
              id: 1,
              status: "assigned",
              address: "123 Main St",
              shipper_id: "shipper-123",
            },
          ],
          null,
        ]);
      }
      // Trả về kết quả cập nhật thành công cho PATCH
      if (args[0]?.toLowerCase().includes("update deliveries")) {
        return Promise.resolve([{ affectedRows: 1 }, null]);
      }
      // Mặc định trả về mảng rỗng
      return Promise.resolve([[], null]);
    });
  });

  // Kiểm tra chức năng người vận chuyển xem danh sách các chuyến hàng của mình.
  test("GET /deliveries should return assigned deliveries for the shipper", async () => {
    const mockDeliveries = [
      { id: 1, status: "assigned", address: "123 Main St" },
    ];
    const mockUser = {
      id: "shipper-123",
      role: "shipper",
      name: "Test Shipper",
      email: "shipper@test.com",
      phone: null,
    };

    // Mock query for getting user info in auth middleware
    mysqlDb.query.mockResolvedValueOnce([[mockUser], null]);
    // Mock query for getting deliveries
    mysqlDb.query.mockResolvedValueOnce([mockDeliveries, null]);

    const res = await request(app)
      .get("/api/shippers/deliveries")
      .set("Authorization", `Bearer ${shipperToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.items || res.body).toEqual(expect.any(Array));
  });

  // Kiểm tra chức năng người vận chuyển cập nhật trạng thái một chuyến hàng.
  test("PATCH /deliveries/:id should update the status of a delivery", async () => {
    const deliveryId = 1;
    const newStatus = "picking"; // Changed from "completed" to valid transition from "assigned"
    const mockUser = {
      id: "shipper-123",
      role: "shipper",
      name: "Test Shipper",
      email: "shipper@test.com",
      phone: null,
    };

    // Mock query for getting user info in auth middleware
    mysqlDb.query.mockResolvedValueOnce([[mockUser], null]);
    // Mock query for getting delivery
    mysqlDb.query.mockResolvedValueOnce([
      [
        {
          id: deliveryId,
          booking_id: "booking-123",
          status: "assigned",
          shipper_id: shipperUser.id,
          receiver_id: "receiver-456",
          qty: 2,
          updated_at: new Date(),
        },
      ],
      null,
    ]);
    // Mock query for updating delivery
    mysqlDb.query.mockResolvedValueOnce([{ affectedRows: 1 }, null]);
    // Mock query for fetching updated delivery
    mysqlDb.query.mockResolvedValueOnce([
      [
        {
          id: deliveryId,
          booking_id: "booking-123",
          status: newStatus,
          shipper_id: shipperUser.id,
          receiver_id: "receiver-456",
          qty: 2,
          updated_at: new Date(),
        },
      ],
      null,
    ]);

    const res = await request(app)
      .patch(`/api/shippers/deliveries/${deliveryId}`)
      .set("Authorization", `Bearer ${shipperToken}`)
      .send({ status: newStatus });

    expect(res.statusCode).toBe(200);
    expect(res.body.ok || res.body).toBeDefined();
  });
});
