# Integration Tests Summary Report

## Báo cáo Kiểm Tra Tích Hợp (Integration Tests)

**Ngày**: 17 tháng 11, 2025  
**Trạng thái**: Phát triển hoàn thiện (Partial Complete)  
**Phiên bản**: v1.0

---

## 📊 Tóm Tắt Thực Hiện

### Kết Quả Chạy Toàn Bộ Test Suites

```
✅ Passed:  2 suites (AUTH + CAMPAIGNS)
❌ Failed:  3 suites (METRICS + USERS + ADMIN)
📈 Total:   5 test suites
```

| Suite Name                | Test Count | Passed | Failed | Status            |
| ------------------------- | ---------- | ------ | ------ | ----------------- |
| **Authentication (AUTH)** | 5          | 5      | 0      | ✅ PASS           |
| **Campaigns**             | 8          | 8      | 0      | ✅ PASS           |
| **Admin Metrics**         | 5          | 2      | 3      | ❌ FAIL (404s)    |
| **User Profile**          | 6          | 0      | 6      | ❌ FAIL (404s)    |
| **Admin Users**           | 7          | 2      | 5      | ❌ SKIP (no data) |
| **TOTAL**                 | 31         | 17     | 14     | ⚠️ Partial        |

---

## ✅ Suites Hoàn Thiện

### 1. AUTH Integration Tests (5/5 Pass)

Kiểm tra flow xác thực (register, login, change password)

**Test cases:**

- `AUTH-INT-01`: Register User — ✅ PASS (201)
- `AUTH-INT-02`: Login — ✅ PASS (200)
- `AUTH-INT-03`: Get Profile — ✅ PASS (200)
- `AUTH-INT-04`: Change Password — ✅ PASS (200)
- `AUTH-INT-05`: Login with New Password — ✅ PASS (200)

**Details:**

- Tạo user mới thành công với email/password
- Login lấy JWT token
- Lấy profile user hiện tại
- Thay đổi password an toàn (gửi email fallback)
- Verify login với password mới

**Database prep:** Tự động seed user test trong DB (xoá và tạo lại mỗi lần chạy)

---

### 2. Campaigns Integration Tests (8/8 Pass)

Kiểm tra quản lý chiến dịch (list, filter, donate, stats)

**Test cases:**

- `CAMP-INT-01`: List All Campaigns — ✅ PASS (1 campaign)
- `CAMP-INT-02`: Get Campaign Details — ✅ PASS (UUID ID match)
- `CAMP-INT-03`: Filter by Status — ✅ PASS (200)
- `CAMP-INT-04`: Search Campaigns — ✅ PASS (200)
- `CAMP-INT-05`: Sort Campaigns — ✅ PASS (200)
- `CAMP-INT-06`: Donate to Campaign — ✅ PASS (200)
- `CAMP-INT-07`: Campaign Stats — ✅ PASS (raised=100000)
- `CAMP-INT-08`: Campaign Donations List — ✅ PASS (1 donation)

**Details:**

- Seed tự động tạo 1 campaign sample + 1 donation
- List campaigns với pagination, filter by status, search, sort
- Donation flow: tiền (money) → status=pending, bữa (meal) → status=pledged
- Stats tính tổng raised, supporters, meals from donations
- Xem donation list của campaign (success only)

**Database prep:** Seed tạo campaign UUID id + donation với meta JSON

---

## ❌ Suites Cần Fix (404 Not Found)

### 3. Admin Metrics Tests (2/5 Pass)

**Issues:**

- `ADMN-MTR-03`: Donor Statistics — 404
- `ADMN-MTR-04`: Campaign Statistics — 404
- `ADMN-MTR-05`: Overview Metrics — 404

**Nguyên nhân:**

- Routes `/api/admin/analytics/donors`, `/api/admin/analytics/campaigns`, `/api/admin/overview` chưa được triển khai hoặc có đường dẫn sai

**Cách fix:**

- Kiểm tra `src/routes/analytics.deliveries.js` hoặc tạo `/api/admin/analytics/...` routes
- Hoặc bỏ qua tests này nếu chúng không cần thiết cho hiện tại

---

### 4. User Profile Tests (0/6 Pass)

**Issues:**

- Tất cả 6 test returns 404 (GET /api/users/me, /profile, /history, etc.)

**Nguyên nhân:**

- Routes `/api/users/me`, `/api/users/:id/deliveries`, `/api/users/:id/donations` chưa được implement hoặc sai endpoint

**Cách fix:**

- Thêm endpoints vào `src/routes/users.js`
- Hoặc skip tests này

---

### 5. Admin Users Tests (2/7 Pass)

**Issues:**

- `ADMIN-USR-02` đến `ADMIN-USR-06`: SKIP (no users in DB sau seed)

**Nguyên nhân:**

- Seed chỉ tạo 2 users (admin@bua.com, donor@bua.com)
- Tests cần 1+ non-admin users để test update, ban, unban

**Cách fix:**

- Update seed để tạo thêm test users không phải admin
- Hoặc update tests để cấu hình dữ liệu riêng

---

## 🔧 Cơ Chế Runner và Seeding

### IntegrationTest/runner.js

File chính orchestrate các test suites, có tính năng:

```bash
# Chạy tất cả suites
node runner.js all -v

# Chạy suite cụ thể (auth, campaigns, metrics, users, admin)
node runner.js auth -v
node runner.js campaigns -v

# Output: per-test status + errorIntegration.md + test-report.html
```

**Features:**

- ✅ Pre-run seeding (gọi `src/seed_mysql.js` trước khi chạy)
- ✅ Per-test status output (PASS/FAIL/SKIP)
- ✅ Error capture (STDOUT/STDERR)
- ✅ HTML report generation (`test-report.html`)
- ✅ Route serve report (`GET /test-report`)
- Verbose mode (`-v`) để in chi tiết

---

### src/seed_mysql.js

Auto-seed DB trước khi chạy tests:

```javascript
// Ensure MySQL tables (via ensure-mysql.js)
// Truncate + reseed từ seed_db.sql
// Tạo test users: admin@bua.com (admin), donor@bua.com (donor)
// Tạo sample campaign + donation (nếu chưa có)
```

**Key:**

- Password hashed với `bcrypt` (10 rounds)
- Campaign id = UUID (CHAR(36))
- Donations có order_id, type (money/food), amount, qty, status

---

## 📝 Database Schema

**Bảng chính được tạo bởi `src/lib/ensure-mysql.js`:**

```sql
-- users (CHAR(36) id, UUID)
-- campaigns (CHAR(36) id, UUID, + donation agg fields)
-- donations (INT id, CHAR(36) campaign_id, order_id, type, amount, qty, status, ...)
-- food_items, bookings, deliveries, ...
-- metrics_daily, site_settings, announcements, payments, ...
```

**Charset:** UTF-8 (utf8mb4) để hỗ trợ tiếng Việt

---

## 🚀 Cách Chạy Integration Tests

### 1. Preparation

```bash
# Đảm bảo MySQL running
# Database: bua_com_xanh
# User: root (password: "")
```

### 2. Chạy từ `backend/` directory

```powershell
# Chạy campaigns (hoàn thiện)
node IntegrationTest/runner.js campaigns -v

# Chạy auth (hoàn thiện)
node IntegrationTest/runner.js auth -v

# Chạy tất cả suites (có error)
node IntegrationTest/runner.js all -v
```

### 3. View Report

```bash
# File HTML được tạo tại: backend/test-report.html
# Route: GET http://localhost:4000/test-report (khi server chạy)

# Hoặc file markdown: IntegrationTest/errorIntegration.md
```

---

## 🛠️ Issues Đã Fix

| Issue                                         | Root Cause                                      | Fix                                             | Date   |
| --------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ------ |
| **SQL "Unknown column 'order_id'"**           | `donations` table chưa được tạo                 | Thêm CREATE TABLE donations vào ensure-mysql.js | Nov 17 |
| **SQL "Unknown column 'owner_id'"**           | Schema mismatch khi seed campaign               | Đổi campaign id thành UUID, remove owner_id     | Nov 17 |
| **Donation INSERT error (route 500)**         | Đúng schema nhưng seed chưa tạo donations table | Thêm bảng donations vào DB schema               | Nov 17 |
| **Campaign donation endpoint test FAIL**      | Seed không insert donation sample               | Update seed để insert donation mẫu              | Nov 17 |
| **Runner không tạo HTML report**              | Generator chưa được gọi                         | Thêm generateReport() call vào runner           | Nov 17 |
| **Rate limit ERR_ERL_PERMISSIVE_TRUST_PROXY** | `trust proxy` sai trong test env                | Set `app.set('trust proxy', false)` cho test    | Nov 17 |

---

## 📂 File Structure (Current)

```
backend/
├── IntegrationTest/
│   ├── runner.js                    # Test orchestrator (main entry)
│   ├── tests/
│   │   ├── 01-auth.integration.test.js
│   │   ├── 02-metrics.integration.test.js
│   │   ├── 03-campaigns.integration.test.js
│   │   ├── 04-users.integration.test.js
│   │   └── 05-admin-users.integration.test.js
│   ├── errorIntegration.md          # Error report (auto-generated)
│   ├── archived-md/                 # Old docs (archived)
│   ├── uploads/                     # Test file uploads
│   └── test-reports/                # Generated reports
├── src/
│   ├── app.js                       # Express app (mount test-report route)
│   ├── server.js                    # Server entry
│   ├── seed_mysql.js                # Seeding script (auto-run)
│   ├── lib/
│   │   ├── ensure-mysql.js          # Schema creation/ALTERs
│   │   ├── reportGenerator.js       # HTML report generator (NEW)
│   │   ├── db.mysql.js              # MySQL connection pool
│   │   └── db.js                    # SQLite fallback
│   └── routes/
│       ├── testReport.js            # GET /test-report route (NEW)
│       ├── auth.js
│       ├── campaigns.js
│       ├── users.js
│       └── ... (other routes)
├── test-report.html                 # HTML report (auto-generated)
└── TEST_REPORT_README.md            # Quick ref for running tests
```

---

## 🎯 Next Steps (Recommended)

### High Priority

1. **Fix Metrics endpoints** (404s)
   - Tìm hoặc tạo `/api/admin/analytics/donors`, `/campaigns`, `/overview`
2. **Fix User Profile endpoints** (404s)

   - Tìm hoặc tạo `/api/users/me`, `/history`, `/donations` endpoints

3. **Fix Admin Users seed**
   - Seed thêm non-admin test users để tests không skip

### Medium Priority

4. **Integrate with CI/CD** (GitHub Actions, etc.)

   - Auto-run tests trước mỗi commit/PR

5. **Expand test coverage**
   - Thêm edge cases, error scenarios

### Low Priority

6. **Remove archived-md folder**
   - Xóa `IntegrationTest/archived-md/` khi chắc chắn không cần

---

## 📞 Troubleshooting

### Tests hang / timeout

```bash
# Check MySQL server is running
# Check DB credentials in .env or defaults

# Logs: see console output hoặc IntegrationTest/errorIntegration.md
```

### 404 errors in test suites

```bash
# Check route exists: grep -r "GET /api/..." src/routes/
# Check app.js mounts the router
# Check auth token is valid (may need token refresh)
```

### Seeding fails

```bash
# Check seed_mysql.js imports and bcrypt is installed
# Check DB user/password
# Check seed_db.sql exists and has correct TRUNCATE syntax
```

---

## 🏁 Conclusion

Integration tests cho 2 suites (AUTH + CAMPAIGNS) **hoàn thiện 100%**, với tất cả test cases pass.  
3 suites còn lại (METRICS, USERS, ADMIN) cần fix routes/endpoints để hoàn thiện.

**Tác dụng hiện tại:**

- ✅ Validate auth flow (register, login, password change)
- ✅ Validate campaign CRUD + donation flow
- ✅ Validate MySQL schema + seeding
- ✅ Auto-generate error reports (HTML + Markdown)
- ✅ Easy to extend: thêm test file vào `tests/` + update runner.js

**Để tiếp tục phát triển:**

- Fix routes cho Metrics/Users/Admin suites
- Update seed để có enough test data
- Run full suite cho CI/CD

---

**Last Updated**: 17 November 2025  
**By**: Integration Test Team  
**Repository**: bua_com_xanh_quan  
**Branch**: main
