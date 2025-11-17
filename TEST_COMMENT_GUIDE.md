# 📖 Hướng Dẫn Comment Code Test - Tiếng Việt

## 🎯 Quy Chuẩn Comment Trong Test File

### 1️⃣ **Header Comment - Mô Tả File**

```javascript
/**
 * File: backend/test/admin.users.test.js
 * Chức năng: Test các API quản lý người dùng (tạo, sửa, xóa, lọc user)
 *
 * Các test case bao gồm:
 * - Tạo người dùng mới với các role khác nhau (admin, user, shipper)
 * - Cập nhật thông tin người dùng (email, phone, avatar)
 * - Xóa người dùng và kiểm tra cascade delete
 * - Tìm kiếm & lọc người dùng theo status, role, keyword
 * - Kiểm tra quyền truy cập (chỉ admin được phép)
 *
 * Database test: SQLite + MySQL
 */
```

### 2️⃣ **Mock/Setup Comment - Giải Thích Giả Lập**

```javascript
// --- MOCK DATABASE ---
// Giả lập các hàm database để tránh phụ thuộc vào DB thật
// Giúp test nhanh, độc lập, có thể kiểm soát kết quả trả về
jest.unstable_mockModule("../src/lib/db.js", () => ({
  db: {
    prepare: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  },
}));

// --- MOCK AUTHENTICATION ---
// Giả lập middleware kiểm tra quyền admin
// Cho phép tất cả request đi qua để tập trung test logic route
jest.unstable_mockModule("../src/middlewares/roles.js", () => ({
  requireRole: () => (req, res, next) => next(),
}));
```

### 3️⃣ **Helper Function Comment - Hàm Hỗ Trợ**

```javascript
/**
 * Tạo token JWT giả cho việc test xác thực
 * @param {Object} payload - Dữ liệu user (id, role, email)
 * @returns {string} Token JWT đã ký
 *
 * Ví dụ:
 * const adminToken = signTestToken({ id: "1", role: "admin" });
 */
const signTestToken = (payload) => {
  return jwt.sign(payload, "test_secret", { expiresIn: "1d" });
};
```

### 4️⃣ **BeforeAll Comment - Setup Ban Đầu**

```javascript
// Chạy 1 lần trước tất cả test
// Dùng để setup app, database mock, environment variables
beforeAll(async () => {
  process.env.DB_DRIVER = driver;
  process.env.JWT_SECRET = "test_secret";
  jest.resetModules(); // Reload modules để áp dụng env mới

  // ... setup code ...
});
```

### 5️⃣ **BeforeEach Comment - Reset Giữa Các Test**

```javascript
// Chạy trước mỗi test để reset trạng thái
// Đảm bảo các test không ảnh hưởng lẫn nhau
beforeEach(() => {
  jest.clearAllMocks(); // Xóa bộ nhớ mock
  mockDbFunctions.all.mockResolvedValue([]); // Reset mock về trạng thái mặc định
});
```

### 6️⃣ **Describe Block Comment - Nhóm Test**

```javascript
/**
 * Nhóm test: Tạo người dùng
 * Kiểm tra:
 * - POST /api/users với dữ liệu hợp lệ
 * - Validate email không trùng
 * - Hash mật khẩu trước khi lưu
 * - Return 201 + user data khi thành công
 */
describe("POST /api/users - Tạo người dùng", () => {
  // ... tests ...
});
```

### 7️⃣ **Test Case Comment - Từng Test**

```javascript
/**
 * Test case: Tạo user thành công với role admin
 *
 * Input:
 * - name: "John Admin"
 * - email: "admin@example.com"
 * - role: "admin"
 *
 * Expected: 201 Created + user object + id được tạo
 */
test("should create admin user successfully", async () => {
  mockDbFunctions.run.mockResolvedValueOnce({ id: "user-123" });

  const res = await request(app).post("/api/users").send({
    name: "John Admin",
    email: "admin@example.com",
    role: "admin",
  });

  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty("id");
});
```

### 8️⃣ **Assertion Comment - Kiểm Tra Chi Tiết**

```javascript
// Kiểm tra status code là 200 (thành công)
expect(res.status).toBe(200);

// Kiểm tra response có trường id
expect(res.body).toHaveProperty("id");

// Kiểm tra email có trong dữ liệu trả về
expect(res.body.email).toBe("test@example.com");

// Kiểm tra mock được gọi đúng 1 lần
expect(mockDbFunctions.get).toHaveBeenCalledTimes(1);

// Kiểm tra mock được gọi với tham số cụ thể
expect(mockDbFunctions.run).toHaveBeenCalledWith(
  expect.stringContaining("INSERT INTO users")
);
```

---

## 📝 Template Comment Chuẩn

### **Cho Backend Test File**

```javascript
/**
 * File: backend/test/{feature}.test.js
 * Chức năng: [Mô tả tính năng cần test]
 *
 * Test coverage:
 * - [Test 1]
 * - [Test 2]
 * - [Test 3]
 *
 * Database: SQLite + MySQL
 * Auth: JWT mock + Role mock
 */

// --- MOCK MODULES ---
// [Giải thích từng mock]

// --- HELPER FUNCTIONS ---
// [Giải thích từng helper function]

describe("Feature Name - Tên Tính Năng", () => {
  // --- SETUP ---
  beforeAll(async () => {
    // [Giải thích setup]
  });

  beforeEach(() => {
    // [Giải thích reset]
  });

  // --- TEST GROUPS ---
  describe("GET /api/... - Lấy dữ liệu", () => {
    test("should return 200 with data", () => {
      // [Giải thích test case]
    });
  });

  describe("POST /api/... - Tạo dữ liệu", () => {
    test("should create successfully", () => {
      // [Giải thích test case]
    });
  });

  describe("Error cases - Trường hợp lỗi", () => {
    test("should return 400 if invalid input", () => {
      // [Giải thích test case]
    });
  });
});
```

### **Cho Frontend Test File**

```javascript
/**
 * File: frontend/src/{feature}.test.js
 * Chức năng: [Mô tả tính năng UI cần test]
 *
 * Test bao gồm:
 * - [Render test]
 * - [User interaction test]
 * - [State change test]
 * - [Error handling test]
 */

describe("Component/Hook Name - Tên Component", () => {
  beforeEach(() => {
    // Reset trước mỗi test
    jest.clearAllMocks();
  });

  describe("Rendering - Hiển thị", () => {
    test("should render correctly", () => {
      // [Giải thích test case]
    });
  });

  describe("User Interactions - Tương tác người dùng", () => {
    test("should handle click event", () => {
      // [Giải thích test case]
    });
  });

  describe("Error Handling - Xử lý lỗi", () => {
    test("should show error message", () => {
      // [Giải thích test case]
    });
  });
});
```

---

## 🔍 Ví Dụ Comment Hoàn Chỉnh

### **Backend**

```javascript
/**
 * File: backend/test/payments.test.js
 * Chức năng: Test API xử lý thanh toán (MoMo, VietQR)
 *
 * Coverage:
 * - Tạo đơn thanh toán mới
 * - Callback từ MoMo webhook
 * - Verify chữ ký webhook
 * - Cập nhật trạng thái thanh toán
 * - Xử lý lỗi payment fail
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

// --- MOCK PAYMENT GATEWAY ---
// Giả lập MoMo API để tránh gọi API thật
// Kết quả trả về được kiểm soát để test các trường hợp khác nhau
jest.unstable_mockModule("../src/lib/momo.js", () => ({
  createPayment: jest.fn(),
  verifySignature: jest.fn(),
}));

/**
 * Tạo webhook payload từ MoMo
 * @param {Object} data - Dữ liệu thanh toán
 * @returns {Object} Webhook payload đã ký
 */
const createMoMoWebhook = (data) => {
  return {
    transId: data.transId,
    amount: data.amount,
    resultCode: 0, // 0 = success
    signature: "fake_signature",
  };
};

describe("Payments API - API Thanh Toán", () => {
  let app;
  let mockMoMo;

  beforeAll(async () => {
    // Load momo module đã được mock
    const momoModule = await import("../src/lib/momo.js");
    mockMoMo = momoModule;

    // Cài đặt Express app
    process.env.JWT_SECRET = "test_secret";
    // ... setup app ...
  });

  beforeEach(() => {
    // Reset mock trước mỗi test để đảm bảo độc lập
    jest.clearAllMocks();
  });

  describe("POST /api/payments - Tạo thanh toán", () => {
    /**
     * Test: Tạo thanh toán thành công
     *
     * Input:
     * - amount: 100000 (100k VND)
     * - orderId: "order-123"
     * - description: "Thanh toán bữa ăn"
     *
     * Expected:
     * - Status: 201 Created
     * - Response chứa paymentUrl để redirect tới MoMo
     */
    test("should create payment successfully", async () => {
      mockMoMo.createPayment.mockResolvedValueOnce({
        paymentUrl: "https://momo.vn/pay?...",
        transId: "momo-trans-123",
      });

      const res = await request(app).post("/api/payments").send({
        amount: 100000,
        orderId: "order-123",
        description: "Thanh toán bữa ăn",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("paymentUrl");
      expect(mockMoMo.createPayment).toHaveBeenCalled();
    });
  });

  describe("POST /api/payments/webhook - Callback từ MoMo", () => {
    /**
     * Test: Xử lý callback thanh toán thành công
     *
     * Webhook từ MoMo gửi:
     * - transId: ID giao dịch
     * - resultCode: 0 (thành công)
     * - signature: Chữ ký xác thực
     *
     * Expected:
     * - Cập nhật trạng thái payment thành "completed"
     * - Gửi email xác nhận
     * - Return 200 OK
     */
    test("should handle MoMo webhook callback", async () => {
      const webhook = createMoMoWebhook({
        transId: "momo-123",
        amount: 100000,
      });

      mockMoMo.verifySignature.mockResolvedValueOnce(true);

      const res = await request(app)
        .post("/api/payments/webhook")
        .send(webhook);

      expect(res.status).toBe(200);
      expect(mockMoMo.verifySignature).toHaveBeenCalledWith(webhook);
    });

    /**
     * Test: Từ chối webhook với chữ ký sai
     *
     * Security check: Verify chữ ký webhook trước khi xử lý
     *
     * Expected:
     * - Status: 401 Unauthorized
     * - Không cập nhật payment
     */
    test("should reject webhook with invalid signature", async () => {
      const webhook = createMoMoWebhook({
        transId: "momo-123",
        amount: 100000,
      });

      mockMoMo.verifySignature.mockResolvedValueOnce(false);

      const res = await request(app)
        .post("/api/payments/webhook")
        .send(webhook);

      expect(res.status).toBe(401);
    });
  });
});
```

### **Frontend**

```javascript
/**
 * File: frontend/src/hooks/useCart.test.js
 * Chức năng: Test Hook quản lý giỏ hàng
 *
 * Coverage:
 * - Thêm sản phẩm vào giỏ
 * - Xóa sản phẩm khỏi giỏ
 * - Cập nhật số lượng
 * - Persist giỏ hàng vào localStorage
 * - Tính tổng tiền chính xác
 */

import { renderHook, act } from "@testing-library/react";
import { useCart } from "./useCart";

describe("useCart Hook - Hook Giỏ Hàng", () => {
  beforeEach(() => {
    // Xóa localStorage trước mỗi test
    localStorage.clear();
  });

  describe("Adding items - Thêm sản phẩm", () => {
    /**
     * Test: Thêm sản phẩm vào giỏ
     *
     * Input:
     * - product: { id: 1, name: "Cơm", price: 25000 }
     * - quantity: 2
     *
     * Expected:
     * - Giỏ hàng có 1 item
     * - Tổng tiền = 25000 * 2 = 50000
     */
    test("should add item to cart", () => {
      const { result } = renderHook(() => useCart());

      act(() => {
        result.current.addItem({ id: 1, name: "Cơm", price: 25000 }, 2);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.total).toBe(50000);
    });

    /**
     * Test: Tăng số lượng nếu sản phẩm đã tồn tại
     *
     * Scenario:
     * - Thêm sản phẩm lần 1: quantity = 1
     * - Thêm sản phẩm lần 2: quantity = 2
     *
     * Expected:
     * - Giỏ vẫn có 1 item (không tạo duplicate)
     * - quantity = 1 + 2 = 3
     */
    test("should increase quantity if item exists", () => {
      const { result } = renderHook(() => useCart());
      const product = { id: 1, name: "Cơm", price: 25000 };

      act(() => {
        result.current.addItem(product, 1);
        result.current.addItem(product, 2);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].quantity).toBe(3);
    });
  });

  describe("Removing items - Xóa sản phẩm", () => {
    /**
     * Test: Xóa sản phẩm khỏi giỏ
     *
     * Expected:
     * - Sản phẩm bị loại bỏ
     * - Giỏ hàng được update
     * - localStorage được sync
     */
    test("should remove item from cart", () => {
      const { result } = renderHook(() => useCart());

      act(() => {
        result.current.addItem({ id: 1, name: "Cơm", price: 25000 }, 1);
        result.current.removeItem(1);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe("Persistence - Lưu trữ", () => {
    /**
     * Test: Lưu giỏ hàng vào localStorage
     *
     * Expected:
     * - Khi refresh page, giỏ hàng vẫn tồn tại
     * - Data được read từ localStorage
     */
    test("should persist cart to localStorage", () => {
      const { result } = renderHook(() => useCart());

      act(() => {
        result.current.addItem({ id: 1, name: "Cơm", price: 25000 }, 2);
      });

      // Giả lập refresh page (hook mới render)
      const stored = JSON.parse(localStorage.getItem("cart"));
      expect(stored).toHaveLength(1);
      expect(stored[0].quantity).toBe(2);
    });
  });
});
```

---

## ✅ Checklist Khi Comment Code Test

- [ ] Header comment giải thích file
- [ ] Comment giải thích từng mock
- [ ] Comment giải thích helper functions
- [ ] Comment cho beforeAll, beforeEach
- [ ] Comment describe block (nhóm test)
- [ ] Comment cho từng test case
- [ ] Comment giải thích assertions quan trọng
- [ ] Comment Tiếng Việt rõ ràng, không lủng củng
- [ ] Có ví dụ input/output trong comment
- [ ] Ghi chú các edge cases nếu có

---

## 📌 Lưu Ý Quan Trọng

✅ Comment phải **rõ ràng** và **có ý nghĩa**  
✅ Giải thích **WHY** không phải chỉ **WHAT**  
✅ Comment phải **cập nhật** khi thay đổi code  
❌ Tránh comment hiển nhiên (ví dụ: `// increment i`)  
❌ Tránh comment quá dài (max 100 ký tự/dòng)

---

**Được tạo:** November 16, 2025  
**Dự án:** Bữa Cơm Xanh - Test Commenting Guide
