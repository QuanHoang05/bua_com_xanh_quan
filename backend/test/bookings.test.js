// backend/test/bookings.test.js
import { jest, describe, test, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// --- MOCK MODULES ---
jest.unstable_mockModule("../src/lib/db.js", () => ({
  db: {
    // For dbGet, dbAll in bookings.js
    get: jest.fn(),
    all: jest.fn(),
    // For dbRun in bookings.js, which uses .prepare()
    prepare: jest.fn(() => ({
      run: jest.fn(),
    })),
  },
}));
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    query: jest.fn(), // bookings.js dbRun for mysql uses .query
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  },
}));

const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: '1d' });
};

describe("Booking Routes (/api/bookings)", () => {
  const regularUser = { id: 'user-123', role: 'user' };
  const adminUser = { id: 'admin-456', role: 'admin' };
  const userToken = signTestToken(regularUser);
  const adminToken = signTestToken(adminUser);

  const mockBooking = { 
    id: 'booking-abc',
    receiver_id: regularUser.id,
    item_id: 'item-xyz',
    status: 'pending'
  };

  // =======================
  // TEST SUITE FOR SQLITE
  // =======================
  describe("with SQLite DB", () => {
    let app;
    let sqliteDb;

    beforeAll(async () => {
      process.env.DB_DRIVER = "sqlite";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const { bookingsRouter } = await import("../src/routes/bookings.js");
      const dbModule = await import("../src/lib/db.js");
      sqliteDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api", bookingsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra user thường chỉ có thể xem các booking của chính mình.
    test("GET /bookings as user should return own bookings", async () => {
      sqliteDb.all.mockReturnValue([mockBooking]);
      sqliteDb.get.mockReturnValue({ total: 1 });

      const res = await request(app)
        .get("/api/bookings")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    // Kiểm tra user có thể tạo một booking mới.
    test("POST /bookings as user should create a booking", async () => {
        const runMock = jest.fn().mockReturnValue({ changes: 1 });
        sqliteDb.prepare.mockReturnValue({ run: runMock }); // dbRun uses prepare
        sqliteDb.get.mockReturnValue(mockBooking); // The final GET

        const res = await request(app)
            .post("/api/bookings")
            .set("Authorization", `Bearer ${userToken}`)
            .send({ item_id: 'item-xyz', qty: 1, method: 'pickup' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe(mockBooking.id);
    });

    // Kiểm tra user có thể hủy booking của chính mình khi trạng thái là 'pending'.
    test("PATCH /bookings/:id as user can cancel own pending booking", async () => {
        const runMock = jest.fn().mockReturnValue({ changes: 1 });
        sqliteDb.get
            .mockReturnValueOnce(mockBooking) // First GET to find booking
            .mockReturnValueOnce({ ...mockBooking, status: 'cancelled' }); // Second GET to return updated
        sqliteDb.prepare.mockReturnValue({ run: runMock }); // For the UPDATE call

        const res = await request(app)
            .patch(`/api/bookings/${mockBooking.id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({ status: 'cancelled' });

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('cancelled');
    });

    // Kiểm tra user không thể tự ý thay đổi trạng thái booking (ngoại trừ hủy).
    test("PATCH /bookings/:id as user cannot change status unless cancelling", async () => {
        sqliteDb.get.mockReturnValue(mockBooking); // The initial GET for the booking

        const res = await request(app)
            .patch(`/api/bookings/${mockBooking.id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .send({ status: 'completed' }); // Invalid status change for user

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('not_allowed'); // Correct error expected
    });
  });

  // =======================
  // TEST SUITE FOR MYSQL
  // =======================
  describe("with MySQL DB", () => {
    let app;
    let mysqlDb;

    beforeAll(async () => {
      process.env.DB_DRIVER = "mysql";
      process.env.JWT_SECRET = "test_secret";
      jest.resetModules();

      const { bookingsRouter } = await import("../src/routes/bookings.js");
      const dbModule = await import("../src/lib/db.mysql.js");
      mysqlDb = dbModule.db;

      app = express();
      app.use(express.json());
      app.use("/api", bookingsRouter);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Kiểm tra admin có thể xem tất cả các booking.
    test("GET /bookings as admin should see all bookings", async () => {
        const otherBooking = { ...mockBooking, receiver_id: 'other-user-id' };
        mysqlDb.all.mockResolvedValue([mockBooking, otherBooking]);
        mysqlDb.get.mockResolvedValue({ total: 2 });

        const res = await request(app)
            .get("/api/bookings")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.items).toHaveLength(2);
    });

    // Kiểm tra admin có thể hủy booking của bất kỳ user nào.
    test("POST /bookings/:id/cancel as admin can cancel a pending booking", async () => {
        mysqlDb.get
            .mockResolvedValueOnce(mockBooking) // First GET
            .mockResolvedValueOnce({ ...mockBooking, status: 'cancelled' }); // Second GET
        // dbRun for mysql uses .query, see helper in bookings.js
        mysqlDb.query.mockResolvedValue([{ affectedRows: 1 }]);

        const res = await request(app)
            .post(`/api/bookings/${mockBooking.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('cancelled');
    });
  });
});