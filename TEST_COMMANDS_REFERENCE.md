# 🚀 Test Commands & Scripts Reference

## 📋 Tất Cả Lệnh Test Sẵn Có

### **Backend Commands**

```bash
# 📁 Thư mục: backend/

# 1️⃣ Chạy tất cả test
npm test

# 2️⃣ Chạy test với output chi tiết (verbose)
npm run test:verbose

# 3️⃣ Chạy test + tạo báo cáo HTML
npm run test:report

# 4️⃣ Mở báo cáo HTML mới nhất
npm run open:report

# 5️⃣ Chạy một file test cụ thể
npm test -- admin.users.test.js
npm test -- auth.test.js
npm test -- payments.momo.test.js

# 6️⃣ Chạy test matching pattern
npm test -- --testNamePattern="should create user"

# 7️⃣ Chạy test với coverage
npm test -- --coverage

# 8️⃣ Chạy test và xem coverage report
npm test -- --coverage --coverageReporters=text

# 9️⃣ Watch mode (tự động chạy lại khi file thay đổi)
npm test -- --watch

# 🔟 Clear Jest cache
npm test -- --clearCache
```

### **Frontend Commands**

```bash
# 📁 Thư mục: frontend/

# 1️⃣ Chạy tất cả test
npm test

# 2️⃣ Chạy test với output chi tiết (verbose)
npm run test:verbose

# 3️⃣ Chạy test + tạo báo cáo HTML
npm run test:report

# 4️⃣ Mở báo cáo HTML mới nhất
npm run open:report

# 5️⃣ Chạy Cypress E2E test
npm run cypress:run

# 6️⃣ Chạy một file test cụ thể
npm test -- useAdminDashboard.test.js
npm test -- security.frontend.test.js

# 7️⃣ Watch mode
npm test -- --watch

# 8️⃣ Clear Jest cache
npm test -- --clearCache
```

### **Combined Commands**

```bash
# 🔄 Chạy test cả backend và frontend
cd backend && npm test && cd ../frontend && npm test

# 📊 Tạo báo cáo cho cả 2
cd backend && npm run test:report && cd ../frontend && npm run test:report

# 🌐 Chạy E2E test (Cypress)
cd frontend && npm run cypress:run

# ⚡ Chạy tất cả test
npm run run-e2e
```

---

## 📂 Test File Structure

### **Backend Test Files**

```
backend/test/
├── admin.announcements.test.js        # ✅ Test quản lý thông báo
├── admin.audit.test.js                # ✅ Test audit log
├── admin.backup.test.js               # ✅ Test backup dữ liệu
├── admin.campaigns.test.js            # ✅ Test quảng cáo/campaign
├── admin.deliveries.test.js           # ✅ Test giao hàng
├── admin.foods.test.js                # ✅ Test quản lý thực phẩm
├── admin.foods.expire.test.js         # ✅ Test hết hạn thực phẩm
├── admin.impersonate.test.js          # ✅ Test đăng nhập giả
├── admin.metrics.test.js              # ✅ Test thống kê
├── admin.pages.test.js                # ✅ Test quản lý trang
├── admin.payments.test.js             # ✅ Test quản lý thanh toán
├── admin.pickups.test.js              # ✅ Test lấy đồ ăn
├── admin.reports.test.js              # ✅ Test báo cáo
├── admin.settings.test.js             # ✅ Test cấu hình
├── admin.tasks.test.js                # ✅ Test nhiệm vụ
├── admin.users.test.js                # ✅ Test quản lý user
├── api.integration.test.js            # ✅ Test integration API
├── auth.ci.test.js                    # ✅ Test CI authentication
├── auth.test.js                       # ✅ Test login/register
├── bookings.test.js                   # ✅ Test đặt bữa
├── campaigns.test.js                  # ✅ Test campaign
├── data.validation.test.js            # ✅ Test validate dữ liệu
├── donors.test.js                     # ✅ Test nhà tài trợ
├── foods.test.js                      # ✅ Test thực phẩm
├── payments.momo.test.js              # ✅ Test thanh toán MoMo
├── performance.test.js                # ✅ Test hiệu suất
├── recipients.test.js                 # ✅ Test người nhận
├── security.test.js                   # ✅ Test bảo mật
├── security.extended.test.js          # ✅ Test bảo mật mở rộng
├── shippers.test.js                   # ✅ Test shipper
├── upload.test.js                     # ✅ Test upload file
├── users.test.js                      # ✅ Test user
├── webhooks.vietqr.test.js            # ✅ Test webhook VietQR
└── fixtures/                          # Test data & mock data
    ├── users.fixture.js
    ├── foods.fixture.js
    └── ...
```

### **Frontend Test Files**

```
frontend/src/
├── useAdminDashboard.test.js          # ✅ Test admin dashboard hook
├── security.frontend.test.js          # ✅ Test bảo mật frontend
├── hooks/
│   ├── useCart.test.js                # Test giỏ hàng (nếu có)
│   ├── useAuth.test.js                # Test auth hook (nếu có)
│   └── ...
├── components/
│   ├── UserForm.test.js               # Test form component
│   ├── PaymentModal.test.js           # Test payment modal
│   └── ...
└── ...
```

---

## 🧪 Cách Chạy Test Cụ Thể

### **Scenario 1: Test Authentication (Đăng nhập)**

```bash
cd backend
npm test -- auth.test.js

# Với chi tiết
npm run test:verbose -- auth.test.js

# Chỉ test case liên quan "login"
npm test -- auth.test.js --testNamePattern="login"

# Xem báo cáo
npm run open:report
```

### **Scenario 2: Test Payment (Thanh toán)**

```bash
cd backend
npm test -- payments.momo.test.js

# Xem log chi tiết
npm run test:verbose -- payments.momo.test.js

# Mở báo cáo
npm run open:report
```

### **Scenario 3: Test Frontend Component**

```bash
cd frontend
npm test -- useAdminDashboard.test.js

# Watch mode (tự động rerun khi thay đổi)
npm test -- useAdminDashboard.test.js --watch

# Xem báo cáo
npm run open:report
```

### **Scenario 4: Test Tất Cả + Tạo Báo Cáo**

```bash
# Backend
cd backend
npm run test:report  # Tự động chạy test + tạo báo cáo
npm run open:report  # Mở báo cáo HTML

# Frontend
cd ../frontend
npm run test:report
npm run open:report
```

### **Scenario 5: Check Coverage**

```bash
cd backend
npm test -- --coverage

# Frontend
cd ../frontend
npm test -- --coverage
```

---

## 📊 Báo Cáo & Log

### **Vị Trí Báo Cáo**

**Backend:**

```
backend/test-reports/test-report-2025-11-16T15-30-00.html
backend/test-logs/npm-test.log
```

**Frontend:**

```
frontend/test-reports/test-report-2025-11-16T15-30-00.html
frontend/test-logs/jest-test.log
```

### **Mở Báo Cáo**

```bash
# Cách 1: Dùng lệnh npm
cd backend && npm run open:report

# Cách 2: Mở file HTML trực tiếp
# Windows:
start backend/test-reports/test-report-*.html

# macOS:
open backend/test-reports/test-report-*.html

# Linux:
xdg-open backend/test-reports/test-report-*.html
```

### **Xem Log Test**

```bash
# Backend
cat backend/test-logs/npm-test.log

# Frontend
cat frontend/test-logs/jest-test.log

# Windows PowerShell
Get-Content backend\test-logs\npm-test.log | more
```

---

## 🔄 Git Workflow + Test

### **1. Tạo Branch Mới**

```bash
git checkout -b feature/test-auth
# hoặc
git switch -c feature/test-auth
```

### **2. Thêm/Chỉnh Sửa Test**

```bash
# Edit test file
vim backend/test/auth.test.js

# Chạy test để kiểm tra
npm test -- auth.test.js
```

### **3. Tạo Báo Cáo**

```bash
npm run test:report
npm run open:report
```

### **4. Commit Thay Đổi**

```bash
git add backend/test/auth.test.js
git commit -m "test(auth): Thêm test case cho login flow"
```

### **5. Push Lên GitHub**

```bash
git push origin feature/test-auth
```

### **6. Tạo Pull Request**

Vào GitHub → Compare & pull request → Create pull request

---

## 🛠️ Troubleshooting

### **Problem: Test timeout**

```bash
# Tăng timeout thành 30 giây
npm test -- --testTimeout=30000

# Hoặc trong test file:
jest.setTimeout(30000);
```

### **Problem: Module not found**

```bash
# Clear cache
npm test -- --clearCache

# Cài lại dependencies
npm install
npm test
```

### **Problem: Mock không hoạt động**

```bash
# Check jest.config.js
cat backend/jest.config.js

# Run test với debug info
npm test -- --verbose --noStackTrace

# hoặc dùng NODE_DEBUG
NODE_DEBUG=* npm test
```

### **Problem: Report không tạo**

```bash
# Check thư mục test-reports tồn tại chưa
ls -la backend/test-reports/

# Nếu chưa tồn tại, tạo thư mục
mkdir -p backend/test-reports
mkdir -p backend/test-logs

# Run test lại
npm test
```

---

## 📌 Best Practices

✅ **Trước khi commit:**

```bash
npm test              # Chạy test
npm run test:report   # Tạo báo cáo
npm run open:report   # Kiểm tra báo cáo
git diff             # Kiểm tra thay đổi
git commit           # Commit với message rõ ràng
```

✅ **Commit message examples:**

```bash
git commit -m "test(auth): Thêm test case login success"
git commit -m "test(payments): Fix mock MoMo API"
git commit -m "test: Sửa lỗi timeout jest"
git commit -m "docs: Cập nhật hướng dẫn chạy test"
```

✅ **Test naming pattern:**

```javascript
// ✅ Tốt
test("should create user with valid email", () => {});
test("should return 401 when token is invalid", () => {});

// ❌ Tránh
test("test user creation", () => {});
test("it works", () => {});
```

---

## 🔗 Useful Links

- **Jest Official:** https://jestjs.io/
- **Supertest:** https://github.com/visionmedia/supertest
- **Testing Library:** https://testing-library.com/
- **Cypress:** https://cypress.io/

---

**Last Updated:** November 16, 2025  
**Project:** Bữa Cơm Xanh - QA Testing
