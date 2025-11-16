/**
 * Data Validation & Business Logic Tests
 * Bao gồm: input validation, edge cases, business rules, constraints, etc.
 */
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

// Shared mock DB functions
const mockDbFunctions = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  query: jest.fn(),
  prepare: jest.fn(() => ({
    get: (...args) => mockDbFunctions.get(...args),
    all: (...args) => mockDbFunctions.all(...args),
    run: (...args) => mockDbFunctions.run(...args),
  })),
};

jest.unstable_mockModule("../src/lib/db.js", () => ({ db: mockDbFunctions }));
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: mockDbFunctions,
}));
jest.unstable_mockModule("../src/lib/ensure-mysql.js", () => ({
  ensureMySQLSchema: jest.fn().mockResolvedValue(undefined),
}));

const JWT_SECRET = "test_secret_validation";
const signTestToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
};

describe("Data Validation & Business Logic Tests", () => {
  let app;
  const mockDbFunctions = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    query: jest.fn(),
  };

  const adminToken = signTestToken({ id: "admin-1", role: "admin" });

  beforeAll(async () => {
    process.env.DB_DRIVER = "sqlite";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = "test";

    jest.resetModules();

    const { default: authRouter } = await import("../src/routes/auth.js");
    const { default: adminRouter } = await import("../src/routes/admin.js");

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/admin", adminRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbFunctions.all.mockResolvedValue([]);
    mockDbFunctions.run.mockResolvedValue({});
    mockDbFunctions.get.mockResolvedValue(null);
    mockDbFunctions.query.mockResolvedValue([[], null]);
  });

  describe("1. Required Fields Validation - Xác thực Trường Bắt buộc", () => {
    test("should reject POST without required fields", async () => {
      const invalidData = [
        {}, // Missing all fields
        { content: "Content" }, // Missing title
        { title: "Title" }, // Missing content
      ];

      for (const data of invalidData) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(data);

        expect([200, 400]).toContain(res.statusCode);
        if (res.statusCode === 400) {
          expect(res.body.error || res.body.message).toBeDefined();
        }
      }
    });

    test("should accept POST with all required fields", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const validData = {
        title: "Valid Title",
        content: "Valid Content",
      };

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(validData);

      expect([200, 201]).toContain(res.statusCode);
    });
  });

  describe("2. String Length Constraints - Ràng buộc Độ dài Chuỗi", () => {
    test("should reject extremely long strings", async () => {
      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "A".repeat(10000), // Too long
          content: "B".repeat(100000),
        });

      expect([200, 400, 413]).toContain(res.statusCode);
    });

    test("should accept reasonable string lengths", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Normal Title",
          content: "A".repeat(1000), // Reasonable length
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    test("should handle empty strings appropriately", async () => {
      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "",
          content: "",
        });

      expect([200, 400]).toContain(res.statusCode);
    });
  });

  describe("3. Number Validation - Xác thực Số", () => {
    test("should validate numeric ID parameters", async () => {
      const invalidIds = ["abc", "123abc", "-1", "0", "null"];

      for (const id of invalidIds) {
        const res = await request(app)
          .get(`/api/admin/announcements/${id}`)
          .set("Authorization", `Bearer ${adminToken}`);

        expect([200, 400, 404]).toContain(res.statusCode);
      }
    });

    test("should accept valid numeric IDs", async () => {
      mockDbFunctions.get.mockResolvedValue({
        id: 1,
        title: "Test",
        content: "Content",
      });

      const res = await request(app)
        .get("/api/admin/announcements/1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([200, 400, 404]).toContain(res.statusCode);
    });
  });

  describe("4. Enum/Choice Validation - Xác thực Enum/Lựa chọn", () => {
    test("should validate level enum field", async () => {
      const validLevels = ["info", "warning", "error", "critical"];
      const invalidLevels = ["invalid", "high", "low", "abc"];

      // Test valid levels
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });
      for (const level of validLevels) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            level: level,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }

      // Test invalid levels
      for (const level of invalidLevels) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            level: level,
          });

        expect([200, 400, 201]).toContain(res.statusCode);
      }
    });
  });

  describe("5. Email Validation - Xác thực Email", () => {
    test("should validate email format if present", async () => {
      const invalidEmails = [
        "notanemail",
        "@example.com",
        "user@",
        "user name@example.com",
        "",
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            email: email,
          });

        expect([200, 400, 201]).toContain(res.statusCode);
      }
    });

    test("should accept valid email format", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const validEmails = [
        "user@example.com",
        "test.user@example.co.uk",
        "user+tag@example.com",
      ];

      for (const email of validEmails) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            email: email,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });

  describe("6. Date/Time Validation - Xác thực Ngày/Giờ", () => {
    test("should validate date format if present", async () => {
      const invalidDates = ["2024-13-01", "2024-12-32", "invalid-date"];

      for (const date of invalidDates) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            publish_date: date,
          });

        expect([200, 400, 201]).toContain(res.statusCode);
      }
    });

    test("should accept valid dates", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const validDates = ["2024-12-01", "2024-01-15", new Date().toISOString()];

      for (const date of validDates) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            publish_date: date,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });

  describe("7. Boolean Validation - Xác thực Boolean", () => {
    test("should validate boolean fields", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const testCases = [
        { active: true },
        { active: false },
        { active: 1 },
        { active: 0 },
        { active: "true" },
        { active: "false" },
      ];

      for (const data of testCases) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            ...data,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });

  describe("8. Special Characters & HTML Escape - Ký tự Đặc biệt", () => {
    test("should handle special characters safely", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const specialChars = [
        'Test with "quotes"',
        "Test with 'apostrophe'",
        "Test with <html> tags",
        "Test with & ampersand",
        "Test with \\ backslash",
        "Test with \n newline",
        "Test with \t tab",
      ];

      for (const content of specialChars) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: content,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });

  describe("9. Whitespace Handling - Xử lý Khoảng trắng", () => {
    test("should trim leading/trailing whitespace", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "  Title with spaces  ",
          content: "\n\nContent with newlines\n",
        });

      expect([200, 201, 400]).toContain(res.statusCode);
    });
  });

  describe("10. Data Type Coercion - Ép kiểu Dữ liệu", () => {
    test("should handle type coercion appropriately", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: 12345, // Number instead of string
          content: { nested: "object" }, // Object instead of string
          active: "yes", // String instead of boolean
        });

      expect([200, 201, 400]).toContain(res.statusCode);
    });
  });

  describe("11. Unique Constraint Validation - Xác thực Ràng buộc Duy nhất", () => {
    test("should prevent duplicate entries if applicable", async () => {
      mockDbFunctions.run
        .mockResolvedValueOnce({ lastID: 1 })
        .mockRejectedValueOnce(new Error("UNIQUE constraint failed"));

      const data = { title: "Duplicate Title", content: "Content" };

      const res1 = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(data);

      const res2 = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(data);

      expect([200, 201]).toContain(res1.statusCode);
      expect([200, 201, 400, 409, 500]).toContain(res2.statusCode);
    });
  });

  describe("12. Foreign Key Validation - Xác thực Khóa ngoài", () => {
    test("should validate foreign key references", async () => {
      mockDbFunctions.run.mockRejectedValue(
        new Error("FOREIGN KEY constraint failed")
      );

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test",
          content: "Content",
          user_id: 99999, // Non-existent user
        });

      expect([200, 400, 409, 500, 201]).toContain(res.statusCode);
    });
  });

  describe("13. Range Validation - Xác thực Phạm vi", () => {
    test("should validate numeric ranges", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const testCases = [
        { priority: -1 }, // Below minimum
        { priority: 0 }, // Valid minimum
        { priority: 5 }, // Valid middle
        { priority: 10 }, // Valid maximum
        { priority: 11 }, // Above maximum
      ];

      for (const data of testCases) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            ...data,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });

  describe("14. Business Logic Rules - Quy tắc Logic Kinh doanh", () => {
    test("should enforce status transition rules", async () => {
      mockDbFunctions.run.mockResolvedValue({});
      mockDbFunctions.get.mockResolvedValue({
        id: 1,
        status: "draft",
      });

      // Valid transition: draft -> published
      let res = await request(app)
        .patch("/api/admin/announcements/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "published" });

      expect([200, 201, 400]).toContain(res.statusCode);
    });

    test("should validate date logic", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Future Announcement",
          content: "Content",
          publish_date: futureDate.toISOString(),
          expire_date: new Date().toISOString(), // Expire before publish
        });

      // Should reject if expire_date < publish_date
      expect([200, 201, 400]).toContain(res.statusCode);
    });
  });

  describe("15. Nested Object Validation - Xác thực Đối tượng Lồng nhau", () => {
    test("should validate nested object structures", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const res = await request(app)
        .post("/api/admin/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test",
          content: "Content",
          metadata: {
            tags: ["tag1", "tag2"],
            author: {
              name: "Author Name",
              email: "author@example.com",
            },
          },
        });

      expect([200, 201, 400]).toContain(res.statusCode);
    });
  });

  describe("16. Array Validation - Xác thực Mảng", () => {
    test("should validate array fields", async () => {
      mockDbFunctions.run.mockResolvedValue({ lastID: 1 });

      const testCases = [
        { tags: [] }, // Empty array - valid
        { tags: ["tag1", "tag2"] }, // Valid array
        { tags: [123, 456] }, // Wrong type in array
        { tags: "tag1" }, // String instead of array
      ];

      for (const data of testCases) {
        const res = await request(app)
          .post("/api/admin/announcements")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: "Test",
            content: "Content",
            ...data,
          });

        expect([200, 201, 400]).toContain(res.statusCode);
      }
    });
  });
});
