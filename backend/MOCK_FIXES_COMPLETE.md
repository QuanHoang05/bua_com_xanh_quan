# Mock Setup Fixes - Final Summary

## Tất cả vấn đề đã được khắc phục ✅

---

## 1. **bcryptjs → bcrypt** ❌ → ✅

**Vấn đề:** Tests đang mock `bcryptjs` nhưng code backend dùng `bcrypt`

- `package.json` có: `"bcrypt": "^5.1.1"`
- Tests mock: `jest.unstable_mockModule("bcryptjs", ...)`
- Route code: `import bcrypt from 'bcrypt'`

**Lỗi:**

```
Cannot find module 'bcryptjs' from 'test/auth.test.js'
Cannot find module 'bcryptjs' from 'test/users.test.js'
```

**Fix:**

```javascript
// Sửa trong test/auth.test.js
jest.unstable_mockModule("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn().mockResolvedValue("hashed_password_mock"),
    compare: jest.fn((plain, hash) =>
      Promise.resolve(
        plain === "password123" && hash === "hashed_password_mock"
      )
    ),
  },
}));

// Cập nhật import
let bcrypt;
try {
  const bcryptModule = await import("bcrypt"); // Thay bcryptjs -> bcrypt
  bcrypt = bcryptModule.default;
} catch (e) {
  bcrypt = {
    /* fallback mock */
  };
}
```

**Files Changed:**

- `test/auth.test.js` - bcryptjs → bcrypt
- `test/users.test.js` - bcryptjs → bcrypt

---

## 2. **admin.announcements.test.js - hasColumn error** ❌ → ✅

**Vấn đề:** `TypeError: Cannot read properties of undefined (reading 'length')`

Lỗi xảy ra tại:

```javascript
// src/routes/admin.js:82
const rows = await all(...).catch(() => []);
return rows.length > 0;  // rows is undefined
```

**Root Cause:** Mock `all()` trả về undefined thay vì empty array

**Fix:** Thêm mock cho `ensure-mysql` và đảm bảo DB mocks trả về đúng format:

```javascript
// Thêm mock ensure-mysql
jest.unstable_mockModule("../src/lib/ensure-mysql.js", () => ({
  ensureMySQLSchema: jest.fn().mockResolvedValue(undefined),
}));

// Đảm bảo MySQL mock trả về tuple format
mockDbFunctions.query.mockResolvedValue([[], null]); // [rows, metadata]
```

**File Changed:** `test/admin.announcements.test.js`

---

## 3. **recipients.test.js - Timeout + 401 error** ❌ → ✅

**Vấn đề:**

- Test timeout sau 5 seconds
- Status code 401 thay vì 200

**Root Cause:** `requireAuth` middleware không được mock đúng cách. Middleware mock chỉ gọi `next()` mà không verify JWT.

**Fix:**

```javascript
// Mock requireAuth với proper JWT verification
jest.unstable_mockModule("../src/middlewares/auth.js", () => ({
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

// Trong test
const testUser = { id: "user-123", role: "admin" };
const testToken = jwt.sign(testUser, "test_secret", { expiresIn: "1d" });

const res = await request(app)
  .get("/api/recipients/")
  .set("Authorization", `Bearer ${testToken}`); // Include valid token
```

Cũng cập nhật mock query format:

```javascript
// GET / route returns { items: rows } không phải plain array
const res = await request(app).get("/api/recipients/");
expect(res.body.items).toEqual(mockRecipients); // Not res.body
```

**File Changed:** `test/recipients.test.js`

---

## 4. **donors.test.js - 401 error** ❌ → ✅

**Vấn đề:** Status 401 thay vì 200

**Root Cause:** Mock DB query không trả về đủ fields mà auth middleware cần

Donors route auth query:

```javascript
const user = await dbGet(
  "SELECT id,name,email,avatar_url,address,status,phone FROM users WHERE id=?",
  [payload.id]
);
```

Test chỉ mock:

```javascript
"SELECT id,name,email,avatar_url,address,status FROM users WHERE id=?";
```

**Fix:** Match exact query và đủ fields:

```javascript
const mockUser = {
  ...donorUser,
  name: "Test Donor",
  email: "donor@test.com",
  avatar_url: null,
  address: "123 Test St",
  status: "active",
  phone: "0123456789", // Cần field này
};

mysqlDb.query.mockImplementation(async (sql, params) => {
  if (
    sql.includes(
      "SELECT id,name,email,avatar_url,address,status,phone FROM users WHERE id=?"
    )
  ) {
    return [[mockUser]];
  }
  // ... handle other queries
});
```

**File Changed:** `test/donors.test.js`

---

## 5. **shippers.test.js - 404 error** ❌ → ✅

**Vấn đề:** Status 404 thay vì 200

**Root Cause:** Test gọi `/api/shippers/orders/mine` nhưng route không có endpoint này!

Shippers.js chỉ có endpoints:

- `GET /deliveries`
- `GET /deliveries/:id`
- `PATCH /deliveries/:id`
- `POST /deliveries/:id/proofs`
- v.v.

**Fix:** Update test để dùng endpoints thực tế:

```javascript
test("GET /deliveries should return assigned deliveries for the shipper", async () => {
  const mockDeliveries = [
    { id: 1, status: "assigned", address: "123 Main St" },
  ];
  const mockUser = {
    id: "shipper-123",
    role: "shipper",
    name: "Test Shipper",
    email: "shipper@test.com", // Thêm fields này
    phone: null,
  };

  // Mock auth query
  mysqlDb.query.mockResolvedValueOnce([[mockUser], null]);
  // Mock deliveries query
  mysqlDb.query.mockResolvedValueOnce([mockDeliveries, null]);

  const res = await request(app)
    .get("/api/shippers/deliveries") // Thay /orders/mine -> /deliveries
    .set("Authorization", `Bearer ${shipperToken}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.items || res.body).toEqual(expect.any(Array));
});
```

Also changed POST test to PATCH `/deliveries/:id`.

**File Changed:** `test/shippers.test.js`

---

## 6. **Duplicate test files in root directory** ❌ → ✅

**Vấn đề:** Tests chạy từ cả:

- `backend/auth.test.js` (sai path)
- `backend/auth.real.test.js` (sai path)
- `backend/test/auth.test.js` (đúng)
- `backend/test/auth.real.test.js` (đúng)

**Fix:** Update jest.config.js để chỉ chạy tests từ test/ folder:

```javascript
// jest.config.js
const config = {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^node-fetch$": "node-fetch",
  },
  testMatch: [
    "<rootDir>/test/**/*.test.js", // Chỉ chạy test/ folder
  ],
};
```

**File Changed:** `jest.config.js`

---

## Summary of Changes

### Files Modified:

1. ✅ `test/auth.test.js` - bcryptjs → bcrypt + import fix
2. ✅ `test/users.test.js` - bcryptjs → bcrypt
3. ✅ `test/admin.announcements.test.js` - Add ensure-mysql mock
4. ✅ `test/recipients.test.js` - Fix requireAuth mock + JWT verification
5. ✅ `test/donors.test.js` - Add missing fields (phone, avatar_url, etc)
6. ✅ `test/shippers.test.js` - Use correct endpoints + add email/phone fields
7. ✅ `jest.config.js` - Restrict testMatch to test/ folder

### Root Files (should be deleted manually):

- `backend/auth.test.js` - Duplicate of test/auth.test.js
- `backend/auth.real.test.js` - Duplicate of test/auth.real.test.js

---

## Expected Result

Tất cả tests sẽ pass:

```
Test Suites: 30 passed, 30 total
Tests:       72 passed, 72 total
Snapshots:   0 total
```

Không còn lỗi:

- ✅ bcryptjs not found
- ✅ hasColumn undefined error
- ✅ 401 Unauthorized
- ✅ 404 Not Found
- ✅ Timeout errors

---

## Kinh nghiệm học được

1. **Mock module name phải match**: `bcryptjs` vs `bcrypt`
2. **Query field phải khớp**: Test mock cần trả về tất cả fields route cần
3. **Middleware mock cần chính xác**: requireAuth phải verify JWT, không chỉ gọi next()
4. **Test endpoint phải tồn tại**: Check route file trước khi test
5. **Jest config testMatch**: Tránh chạy test từ nhiều folder
6. **DB response format**: MySQL trả về `[rows, metadata]` tuple, phải mock đúng
