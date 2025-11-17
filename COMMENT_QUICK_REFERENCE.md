# 📝 Quick Comment Convention Guide

## 🎯 Comment Pattern Nhanh

### 1. File Header

```javascript
/**
 * File: [path/to/file.test.js]
 * Chức năng: [Tóm tắt chức năng test]
 *
 * Test cases:
 * - [Test 1]
 * - [Test 2]
 */
```

### 2. Mock Section

```javascript
// --- MOCK [MODULE NAME] ---
// [Giải thích mock]
// [Lý do mock]
jest.unstable_mockModule("...", () => ({
  // ...
}));
```

### 3. Helper Function

```javascript
/**
 * [Tên function]
 * @param {Type} param - [Mô tả]
 * @returns {Type} [Mô tả]
 */
const helperFunction = (param) => {
  // ...
};
```

### 4. BeforeAll/BeforeEach

```javascript
// Chạy [khi nào] để [làm gì]
beforeAll(async () => {
  // [Giải thích setup]
});
```

### 5. Describe Block

```javascript
/**
 * Nhóm test: [Tên tính năng]
 * Kiểm tra:
 * - [Điểm kiểm tra 1]
 * - [Điểm kiểm tra 2]
 */
describe("[Tên tính năng]", () => {
  // ...
});
```

### 6. Test Case

```javascript
/**
 * Test: [Mô tả test]
 *
 * Input: [Dữ liệu input]
 * Expected: [Kết quả kỳ vọng]
 */
test("should [hành động] [khi điều kiện]", () => {
  // Arrange: Setup dữ liệu
  // Act: Thực hiện hành động
  // Assert: Kiểm tra kết quả
});
```

### 7. Complex Assertion

```javascript
// Kiểm tra [gì] là [giá trị]
expect(actual).toBe(expected);

// Kiểm tra [gì] có tính chất [tính chất]
expect(object).toHaveProperty("key");

// Kiểm tra [gì] được gọi [số lần]
expect(mockFn).toHaveBeenCalledTimes(1);
```

---

## ⚡ Comment Shortcuts

| Pattern             | Ý nghĩa            | Ví dụ                           |
| ------------------- | ------------------ | ------------------------------- |
| `// --- [NAME] ---` | Section header     | `// --- MOCK DATABASE ---`      |
| `/**` ... `*/`      | Multi-line comment | Function docs                   |
| `// @param`         | Parameter doc      | `@param {string} email`         |
| `// @returns`       | Return value doc   | `@returns {Promise<User>}`      |
| `// TODO:`          | Action needed      | `// TODO: Add more edge cases`  |
| `// FIXME:`         | Bug to fix         | `// FIXME: Mock not working`    |
| `// NOTE:`          | Important info     | `// NOTE: Depends on DB driver` |
| `// HACK:`          | Temporary solution | `// HACK: Bypass for now`       |

---

## 🚀 Real-World Examples

### **Test with Complex Setup**

```javascript
/**
 * File: backend/test/payments.test.js
 * Chức năng: Test xử lý thanh toán MoMo
 */

// --- MOCK MOMO GATEWAY ---
// Giả lập MoMo API để test mà không gọi API thật
jest.unstable_mockModule("../src/lib/momo.js", () => ({
  createPayment: jest.fn(),
  verifySignature: jest.fn(),
}));

// --- HELPER: TẠO WEBHOOK PAYLOAD ---
// Giả lập webhook từ MoMo
const createWebhook = (override = {}) => ({
  transId: "momo-123",
  amount: 100000,
  resultCode: 0,
  ...override,
});

// --- SETUP BACKEND ---
// Tạo Express app + load routes cần test
beforeAll(async () => {
  process.env.JWT_SECRET = "test";
  const { default: app } = await import("../src/app.js");
  // ... setup ...
});

// --- TEST GROUP ---
describe("Payments - Thanh Toán", () => {
  // --- RESET MOCK ---
  // Xóa call history trước mỗi test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- TEST CASE ---
  /**
   * Test: Tạo thanh toán thành công
   * Input: amount=100000, orderId="123"
   * Expected: Status 201, có paymentUrl
   */
  test("should create payment", async () => {
    const payload = createWebhook();
    // Arrange
    mockMoMo.createPayment.mockResolvedValueOnce({
      paymentUrl: "https://...",
      transId: payload.transId,
    });

    // Act
    const res = await request(app)
      .post("/api/payments")
      .send({ amount: 100000 });

    // Assert
    expect(res.status).toBe(201); // Kiểm tra status code
    expect(res.body).toHaveProperty("paymentUrl"); // Kiểm tra response
    expect(mockMoMo.createPayment).toHaveBeenCalled(); // Kiểm tra mock được gọi
  });

  /**
   * Test: Webhook callback từ MoMo
   * Security: Verify chữ ký trước xử lý
   */
  test("should verify webhook signature", async () => {
    mockMoMo.verifySignature.mockResolvedValueOnce(false);

    const res = await request(app)
      .post("/api/webhooks/momo")
      .send(createWebhook());

    expect(res.status).toBe(401); // Từ chối webhook
  });
});
```

### **Test with User Interaction**

```javascript
/**
 * File: frontend/src/hooks/useCart.test.js
 * Chức năng: Test hook quản lý giỏ hàng
 */

import { renderHook, act } from "@testing-library/react";
import { useCart } from "./useCart";

describe("useCart - Giỏ Hàng", () => {
  // Xóa localStorage trước mỗi test
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  /**
   * Test: Thêm sản phẩm vào giỏ
   * Input: product={id:1, price:25000}, qty=2
   * Expected: items.length=1, total=50000
   */
  test("should add item to cart", () => {
    const { result } = renderHook(() => useCart());

    // Gọi hook function
    act(() => {
      result.current.addItem({ id: 1, name: "Cơm", price: 25000 }, 2);
    });

    // Kiểm tra kết quả
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(50000);
  });

  /**
   * Test: Tăng qty nếu sản phẩm đã tồn tại
   * Scenario: Thêm 2 lần cùng 1 sản phẩm
   * Expected: Chỉ 1 item, qty tăng thành 3
   */
  test("should increase qty for existing item", () => {
    const { result } = renderHook(() => useCart());
    const product = { id: 1, name: "Cơm", price: 25000 };

    act(() => {
      result.current.addItem(product, 1); // Lần 1: qty=1
      result.current.addItem(product, 2); // Lần 2: qty+=2
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
  });

  /**
   * Test: Persist giỏ hàng vào localStorage
   * Expected: Khi reload, giỏ hàng vẫn tồn tại
   */
  test("should persist cart to localStorage", () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({ id: 1, price: 25000 }, 2);
    });

    // localStorage được update tự động
    const stored = JSON.parse(localStorage.getItem("cart"));
    expect(stored[0].quantity).toBe(2);
  });
});
```

---

## 📋 Checklist Comment

- [ ] File có header comment?
- [ ] Mỗi mock có giải thích?
- [ ] Helper function có JSDoc?
- [ ] beforeAll/beforeEach có giải thích?
- [ ] Describe block có mô tả?
- [ ] Test case có input/expected?
- [ ] Assertion phức tạp có comment?
- [ ] Tiếng Việt rõ ràng?
- [ ] Không có comment hiển nhiên?
- [ ] Comment cập nhật cùng code?

---

## 🎨 Comment Style Guide

**✅ TỐT:**

```javascript
// Tạo một admin token hợp lệ để test các route admin
const adminToken = createToken({ role: "admin" });

// Kiểm tra email đã được verify (không được null)
expect(user.emailVerifiedAt).not.toBeNull();

// Xóa tất cả data trước mỗi test để đảm bảo độc lập
jest.clearAllMocks();
```

**❌ TRÁNH:**

```javascript
// Create token
const token = createToken({ role: "admin" });

// Check email
expect(user.emailVerifiedAt).not.toBeNull();

// Clear mocks
jest.clearAllMocks();
```

---

## 📚 Template Copy-Paste

### Backend Test Template

```javascript
/**
 * File: backend/test/[feature].test.js
 * Chức năng: [Mô tả]
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

// --- MOCK [MODULE] ---
jest.unstable_mockModule("...", () => ({
  // ...
}));

/**
 * [Helper function]
 */
const helper = () => {
  // ...
};

describe("[Feature Name] - [Tên Tiếng Việt]", () => {
  let app, mock;

  beforeAll(async () => {
    // Setup
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("[Sub Feature]", () => {
    /**
     * Test: [Mô tả]
     * Input: [Dữ liệu]
     * Expected: [Kết quả]
     */
    test("should [hành động]", async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Frontend Test Template

```javascript
/**
 * File: frontend/src/[feature].test.js
 * Chức năng: [Mô tả]
 */

import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";

describe("[Component/Hook] - [Tên Tiếng Việt]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("[Feature]", () => {
    /**
     * Test: [Mô tả]
     * Input: [Dữ liệu]
     * Expected: [Kết quả]
     */
    test("should [hành động]", () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

**Version:** 1.0  
**Last Updated:** November 16, 2025  
**Project:** Bữa Cơm Xanh
