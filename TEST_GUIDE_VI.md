# 📋 Hướng Dẫn Kiểm Thử - Bữa Cơm Xanh

## 📖 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Cấu Trúc Kiểm Thử](#cấu-trúc-kiểm-thử)
3. [Chạy Test Cục Bộ](#chạy-test-cục-bộ)
4. [Chạy Test Trên CI/CD](#chạy-test-trên-cicd)
5. [Báo Cáo Test](#báo-cáo-test)
6. [Giải Quyết Vấn Đề](#giải-quyết-vấn-đề)

---

## 🎯 Tổng Quan

Bữa Cơm Xanh sử dụng hệ thống kiểm thử toàn diện để đảm bảo chất lượng mã nguồn:

| Loại Test         | Công Cụ           | Trạng Thái            | Ghi Chú                                              |
| ----------------- | ----------------- | --------------------- | ---------------------------------------------------- |
| **Unit Test**     | Jest              | ✅ 210 test (Backend) | Kiểm thử từng hàm riêng lẻ                           |
| **Integration**   | Jest + Supertest  | ✅ 50+ test           | Kiểm thử API endpoints                               |
| **Security**      | Jest + Custom     | ✅ 50+ test           | CSRF, XSS, rate-limiting                             |
| **Performance**   | Jest Benchmarks   | ✅ 7 scenarios        | Response time, memory                                |
| **Frontend**      | React Testing Lib | ✅ 40 test            | Component & hooks                                    |
| **E2E (Cypress)** | Cypress           | ⛔ Tạm dừng           | Xem [CYPRESS_CANNOT_RUN.md](./CYPRESS_CANNOT_RUN.md) |

---

## 🏗️ Cấu Trúc Kiểm Thử

### Backend (`backend/test/`)

```
test/
├── admin.*.test.js              # Kiểm thử quản trị viên (announcements, users, foods, etc.)
├── auth.test.js                 # Kiểm thử xác thực
├── auth.ci.test.js              # CI-specific authentication
├── bookings.test.js             # Kiểm thử đặt lịch
├── campaigns.test.js            # Kiểm thử campaigns (chiến dịch)
├── donors.test.js               # Kiểm thử nhà tài trợ
├── foods.test.js                # Kiểm thử thực phẩm
├── payments.momo.test.js         # Kiểm thử thanh toán Momo
├── security.test.js             # Kiểm thử bảo mật cơ bản
├── security.extended.test.js    # Kiểm thử bảo mật nâng cao
├── performance.test.js          # Kiểm thử hiệu năng
├── upload.test.js               # Kiểm thử tải tệp
├── webhooks.vietqr.test.js      # Kiểm thử webhook VietQR
└── ...
```

### Frontend (`frontend/src/hooks/`)

```
src/
├── hooks/*.test.js              # Kiểm thử custom hooks
│   ├── useAdminDashboard.test.js
│   ├── useCampaigns.test.js
│   ├── useProfile.test.js
│   └── ...
└── security.frontend.test.js    # Kiểm thử bảo mật frontend
```

---

## ▶️ Chạy Test Cục Bộ

### 1️⃣ Chạy Test Backend

**Toàn bộ test backend:**

```bash
cd backend
npm test
```

**Chỉ chạy một tệp test:**

```bash
npm test -- test/auth.test.js
```

**Chỉ chạy test về security:**

```bash
npm test -- --testPathPattern=security
```

**Chạy test ở chế độ watch (tự động chạy lại khi file thay đổi):**

```bash
npm test -- --watch
```

**Output:**

```
✅ Test Suites: 33 passed, 33 total
✅ Tests: 210 passed, 210 total
✅ Snapshots: 0 total
✅ Time: 42.872s
```

### 2️⃣ Chạy Test Frontend

**Toàn bộ test frontend:**

```bash
cd frontend
npm test
```

**Chỉ chạy một tệp test:**

```bash
npm test -- useAdminDashboard.test.js
```

**Coverage report:**

```bash
npm test -- --coverage
```

### 3️⃣ Chạy Test Cả Backend Và Frontend

**Kịch bản 1: Từng cái một**

```bash
# Terminal 1: Backend
cd backend && npm test

# Terminal 2: Frontend
cd frontend && npm test
```

**Kịch bản 2: Script tự động**

```bash
# Từ thư mục gốc
npm run test:all  # (nếu có)
```

---

## 🚀 Chạy Test Trên CI/CD (GitHub Actions)

### Tự động chạy khi:

- ✅ Push lên branch `main`
- ✅ Tạo Pull Request vào `main`

### Xem kết quả:

1. Mở repository trên GitHub
2. Click tab **"Actions"**
3. Chọn workflow run mới nhất: **"CI - Tests & Audit"**
4. Xem chi tiết từng job:
   - `Backend Tests & Audit (18)` - Node 18
   - `Backend Tests & Audit (20)` - Node 20
   - `Frontend Tests & Audit (18)` - Node 18
   - `Frontend Tests & Audit (20)` - Node 20

### Workflow được chạy:

```yaml
# .github/workflows/ci.yml
Backend: npm ci → npm test → npm audit
Frontend: npm ci → npm test → npm audit
```

---

## 📊 Báo Cáo Test

### Vị Trí Báo Cáo

Sau khi chạy test, báo cáo HTML được lưu tại:

```
backend/test-reports/test-report-YYYY-MM-DD-HH-MM-SS.html
frontend/test-reports/test-report-YYYY-MM-DD-HH-MM-SS.html
```

### Mở Báo Cáo

```bash
# Backend report
open backend/test-reports/test-report-*.html

# Frontend report
open frontend/test-reports/test-report-*.html
```

### Nội Dung Báo Cáo

Báo cáo HTML hiển thị:

- 📈 Thống kê tổng quan (Passed, Failed, Total, %)
- 📋 Bảng chi tiết:
  - **Test Case ID**: Mã định danh test (TC-auth-001)
  - **Endpoint / Function**: API endpoint hoặc hàm được test
  - **Điều kiện tiên quyết**: Môi trường setup
  - **Input / Action**: Dữ liệu đầu vào hoặc thao tác
  - **Kết quả mong muốn**: Expected output
  - **Trạng thái**: ✅ Thành công / ❌ Thất bại
  - **Kết quả thực tế**: Actual output / error message
  - **Môi trường**: Test environment (Jest)
  - **Thời gian**: Thời gian thực thi (ms)

### Ví Dụ Báo Cáo

```
📊 Báo cáo Test Tự động
├── 🟢 210 Test Thành công
├── 🔴 0 Test Thất bại
├── 📌 210 Tổng số Test
├── 💯 100% Tỷ lệ Thành công
├── ⏱️  42.87s Thời gian Chạy
└── 📋 Bảng chi tiết (xem HTML)
```

---

## 🔧 Giải Quyết Vấn Đề

### ❓ Test thất bại cục bộ nhưng pass trên CI?

**Nguyên nhân**: Khác biệt environment (Node version, OS, dependencies)

```bash
# 1. Xóa node_modules và package-lock.json
rm -rf node_modules package-lock.json

# 2. Cài lại dependencies
npm ci

# 3. Chạy test lại
npm test
```

### ❓ Test timeout hoặc hang?

**Giải pháp**:

```bash
# Tăng timeout (mặc định 5000ms)
npm test -- --testTimeout=10000

# Chạy test nối tiếp (không song song)
npm test -- --runInBand
```

### ❓ Không thể import module?

**Giải pháp**:

```bash
# Xác nhận NODE_ENV
export NODE_ENV=test

# Xác nhận đường dẫn import
# Dùng đường dẫn tương đối từ file test
```

### ❓ Database connection error?

**Giải pháp**: Backend test tự động dùng in-memory SQLite

```bash
# Kiểm tra db.sqlite.js tồn tại
ls -la backend/src/lib/db.sqlite.js

# Nếu không, tạo lại từ seed
npm run test:db:reset
```

### ❓ Báo cáo HTML không được tạo?

**Giải pháp**:

```bash
# 1. Kiểm tra test-reporter.cjs tồn tại
ls -la backend/test-reporter.cjs

# 2. Kiểm tra Jest config có reporter
cat backend/jest.config.js | grep reporters

# 3. Chạy test lại với verbose
npm test -- --verbose
```

---

## 📝 Best Practices

### ✅ Khi viết test mới:

1. Đặt tên test rõ ràng, mô tả chức năng

```javascript
// ❌ Không tốt
test('should work', () => { ... });

// ✅ Tốt
test('should create campaign with valid data and return 201', () => { ... });
```

2. Mock dependencies cần thiết

```javascript
jest.mock('../lib/db', () => ({
  db: { prepare: jest.fn(), ... }
}));
```

3. Cleanup sau test

```javascript
afterEach(() => {
  jest.clearAllMocks();
  // Xóa tệp tạm nếu cần
});
```

### ✅ Khi gặp lỗi test:

1. Đọc error message đầy đủ
2. Check pre-condition (database, environment variables)
3. Chạy test đó một mình để isolate issue
4. Thêm console.log() để debug

### ✅ Commit code:

1. Chạy test cục bộ trước: `npm test`
2. Đảm bảo không có console.error/warning
3. Commit kèm theo test cases mới

---

## 🔗 Tài Liệu Liên Quan

- [CYPRESS_CANNOT_RUN.md](./CYPRESS_CANNOT_RUN.md) - Giải thích tại sao Cypress tạm dừng
- [.github/workflows/ci.yml](./.github/workflows/ci.yml) - GitHub Actions workflow
- [backend/jest.config.js](./backend/jest.config.js) - Jest config backend
- [frontend/jest.config.cjs](./frontend/jest.config.cjs) - Jest config frontend

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra [Giải Quyết Vấn Đề](#giải-quyết-vấn-đề)
2. Chạy lại test với `--verbose`
3. Mở GitHub issue nếu cần

---

_Cập nhật: 16/11/2025 | Phiên bản: 1.0_
