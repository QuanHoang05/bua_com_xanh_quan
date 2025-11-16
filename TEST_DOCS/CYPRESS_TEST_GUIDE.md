# 🧪 Hướng Dẫn Chạy Comprehensive Cypress Test Suite

## Tổng Quan

Bộ test này bao gồm:

1. **db_interaction.cy.js** - Test ECP/BAV cho DB interaction via API
2. **security_and_api_comprehensive.cy.js** - 10 phần test bảo mật, API, performance, XSS
3. **bug_discovery.cy.js** - Test tìm bug nâng cao (payment, SSRF, XXE, logic bypass, etc.)

## Chuẩn Bị Môi Trường

### Bước 1: Đảm bảo File `.env.test` Tồn Tại

```bash
cd d:\projectManage\BuaComXanh\BuaComXanh\backend
# Tạo .env.test nếu chưa có
```

`.env.test` nên chứa:

```
NODE_ENV=test
PORT=4000
DB_DRIVER=sqlite
SQLITE_PATH=./test_db.sqlite
JWT_SECRET=test-secret-key
API_URL=http://localhost:4000
```

### Bước 2: Chạy Backend ở Chế Độ Test

Mở PowerShell terminal 1:

```powershell
cd d:\projectManage\BuaComXanh\BuaComXanh\backend
npm run start:test
```

Kỳ vọng thấy:

```
✅ API ready at http://localhost:4000 [env: test]
✅ [INFO] Testing routes are enabled for E2E tests.
```

### Bước 3: Chạy Frontend (Nếu Cần)

Mở PowerShell terminal 2:

```powershell
cd d:\projectManage\BuaComXanh\BuaComXanh\frontend
npm run dev
```

Frontend sẽ chạy ở `http://localhost:5173`.

## Chạy Test Cypress

### Option A: Headless Mode (Tự Động Chạy Hết)

```powershell
cd d:\projectManage\BuaComXanh\BuaComXanh\frontend
npx cypress run --spec "cypress/e2e/db_interaction.cy.js" --env API_URL=http://localhost:4000
npx cypress run --spec "cypress/e2e/security_and_api_comprehensive.cy.js" --env API_URL=http://localhost:4000
npx cypress run --spec "cypress/e2e/bug_discovery.cy.js" --env API_URL=http://localhost:4000
```

Hoặc chạy tất cả cùng lúc:

```powershell
npx cypress run --env API_URL=http://localhost:4000
```

### Option B: Interactive Mode (Cypress GUI)

```powershell
cd d:\projectManage\BuaComXanh\BuaComXanh\frontend
npx cypress open --env API_URL=http://localhost:4000
```

Sau đó click vào file test mong muốn từ giao diện.

## Các Test Chính

### Part 1: API Input Validation

- ❌ SQL Injection detection
- ❌ XSS payload sanitization
- ❌ Oversized payload rejection
- ❌ Email format validation
- ❌ Phone number validation

### Part 2: Auth & Authorization

- ❌ Broken auth attempts
- ❌ Role-based access control bypass
- ❌ Token tampering
- ❌ Privilege escalation

### Part 3: Business Logic

- ❌ Double-booking prevention
- ❌ Negative quantity blocking
- ❌ Over-booking detection
- ❌ Data access control (IDOR)

### Part 4: Performance

- ✅ Response time < 500ms (GET /api/foods)
- ✅ Response time < 1000ms (POST /api/bookings)
- ✅ Pagination efficiency
- ✅ Concurrent request handling

### Part 5: Error Handling

- ❌ Sensitive info leak in errors
- ❌ Consistent error format
- ❌ 404/500 handling

### Part 6: Session Security

- ❌ HttpOnly cookie flag
- ❌ Logout session clearing

### Part 7: Hacker-Found Vulns

- ❌ User enumeration
- ❌ Directory traversal
- ❌ JSONP hijacking
- ❌ IDOR attacks

### Part 8: Frontend XSS

- ❌ Inline script execution
- ❌ onerror handler prevention
- ❌ X-Frame-Options header

### Part 9: Data Validation

- ❌ Expire date in future
- ❌ Mandatory fields required
- ❌ Coordinate validation (lat/lng)

### Part 10: Rate Limiting

- ⏱️ Login rate limit
- ⏱️ Registration rate limit

## Bug Discovery Test (Advanced)

### Payment Vulnerabilities

- ❌ Negative amount blocking
- ❌ Decimal precision exploits
- ❌ Double-spending via race condition
- ❌ Status manipulation

### State Manipulation

- ❌ Booking status unauthorized change
- ❌ Food item qty manipulation

### API Enumeration

- ❌ Hidden admin endpoints exposure
- ❌ Version info leaking

### Resource Exhaustion

- ❌ Image upload size limit
- ❌ Bulk data creation DOS
- ❌ ZIP bomb prevention

### Timing Attacks

- ❌ User enumeration via timing
- ❌ Transaction race conditions

### Business Logic Bypass

- ❌ Completed item re-booking
- ❌ Self-donation prevention

### CVE Patterns

- ❌ XXE (XML External Entity) vulnerability
- ❌ SSRF (Server-Side Request Forgery)
- ❌ Prototype pollution

## Kiểm Tra Kết Quả

### Log Test

Khi chạy test, log sẽ hiển thị:

```
  🔒 Comprehensive Security, API & Bug Discovery Tests
    Part 1: API Input Validation & Injection Prevention
      ✓ Should reject SQL injection in email field
      ✓ Should reject SQL injection in name field during registration
      ✓ Should sanitize XSS payloads in title field (Food item)
      ...
    Part 2: Authentication & Authorization Bypass
      ✓ Should reject login with empty credentials
      ...
```

### File Report

Cypress sẽ generate report trong:

- `frontend/cypress/screenshots/` (nếu test fail)
- `frontend/cypress/videos/` (nếu chạy headless)

### Tìm Bug

Nếu test FAIL:

1. Kiểm tra log chi tiết
2. Xem screenshot/video trong `cypress/screenshots`
3. Check console error của Cypress

Ví dụ FAIL:

```
❌ Should reject SQL injection in email field
AssertionError: expected 200 to not equal 200
```

Điều này có nghĩa: Server đã chấp nhận SQL injection → **VULNERABILITY FOUND!**

## Các Lỗi Thường Gặp

### ❌ Error: connect ECONNREFUSED 127.0.0.1:4000

**Giải pháp:** Backend chưa chạy. Chạy `npm run start:test` trước.

### ❌ Error: cy.resetDatabase is not a function

**Giải pháp:** Đảm bảo `frontend/cypress/support/commands.js` đã load. Check `frontend/cypress/support/e2e.js` có import commands không.

### ❌ Test timeout

**Giải pháp:** Tăng timeout trong `cypress.config.js`:

```javascript
e2e: {
  defaultCommandTimeout: 15000,  // Tăng từ 10000 -> 15000
  requestTimeout: 10000,
}
```

## Khuyến Nghị

1. **Chạy định kỳ** - Hàng tuần hoặc sau mỗi release
2. **CI/CD Integration** - Thêm test vào GitHub Actions
3. **Fix Bug** - Ưu tiên fix mọi test FAIL
4. **Mở Rộng** - Thêm test case cho feature mới

## Liên Hệ Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra lại `.env.test`
2. Xóa DB test cũ: `del test_db.sqlite`
3. Restart backend
4. Clear Cypress cache: `npx cypress cache clear`

---

**Chúc bạn test vui vẻ! 🚀**
