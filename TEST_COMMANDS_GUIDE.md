# 📋 Hướng Dẫn Chạy Test & Push GitHub

## 📁 Cấu Trúc Dự Án

```
BuaComXanh/
├── backend/          # Server API (Node.js + Express + Jest)
├── frontend/         # React UI (Vite + Jest + Cypress)
└── scripts/          # Script tổng hợp
```

---

## 🧪 Hướng Dẫn Chạy Test

### **1. Test Backend**

#### Chạy tất cả test:

```bash
cd backend
npm test
```

#### Chạy test với log chi tiết (verbose):

```bash
cd backend
npm run test:verbose
```

#### Chạy một file test cụ thể:

```bash
cd backend
npm test -- admin.users.test.js
```

#### Chạy test với coverage:

```bash
cd backend
npm test -- --coverage
```

#### Mở báo cáo HTML (sau khi chạy test):

```bash
cd backend
npm run open:report
```

---

### **2. Test Frontend**

#### Chạy tất cả test:

```bash
cd frontend
npm test
```

#### Chạy test với log chi tiết (verbose):

```bash
cd frontend
npm run test:verbose
```

#### Chạy một file test cụ thể:

```bash
cd frontend
npm test -- useAdminDashboard.test.js
```

#### Chạy test với coverage:

```bash
cd frontend
npm test -- --coverage
```

#### Mở báo cáo HTML (sau khi chạy test):

```bash
cd frontend
npm run open:report
```

---

### **3. Test End-to-End (E2E) - Cypress**

#### Chạy Cypress test (giao diện):

```bash
cd frontend
npm run cypress:run
```

#### Chạy E2E test kết hợp:

```bash
npm run run-e2e
```

---

### **4. Test Tổng Hợp (Backend + Frontend)**

#### Chạy test cả backend và frontend:

```bash
# Từ thư mục backend
npm test && cd ../frontend && npm test
```

#### Hoặc dùng script tổng hợp:

```bash
cd scripts
node run-e2e.js
```

---

## 📊 Xem Báo Cáo Test

### **Báo Cáo Backend**

- **Vị trí:** `backend/test-reports/test-report-*.html`
- **Log:** `backend/test-logs/npm-test.log`
- **Mở:** `npm run open:report` (trong thư mục backend)

### **Báo Cáo Frontend**

- **Vị trí:** `frontend/test-reports/test-report-*.html`
- **Log:** `frontend/test-logs/jest-test.log`
- **Mở:** `npm run open:report` (trong thư mục frontend)

---

## 🔍 Cấu Trúc Test

### **Backend Test**

```
backend/test/
├── admin.announcements.test.js     # Test API quản lý thông báo
├── admin.users.test.js             # Test API quản lý người dùng
├── admin.foods.test.js             # Test API quản lý thực phẩm
├── payments.momo.test.js           # Test API thanh toán MoMo
├── auth.test.js                    # Test xác thực & đăng nhập
├── security.test.js                # Test bảo mật
├── performance.test.js             # Test hiệu suất
└── ...
```

### **Frontend Test**

```
frontend/src/
├── useAdminDashboard.test.js       # Test hook admin dashboard
├── security.frontend.test.js       # Test bảo mật frontend
└── ...
```

---

## 🚀 Hướng Dẫn Push GitHub

### **1. Kiểm Tra Trạng Thái Repo**

```bash
git status
```

### **2. Thêm File Vào Staging**

```bash
# Thêm tất cả file thay đổi
git add .

# Hoặc thêm file cụ thể
git add backend/test/admin.users.test.js
git add frontend/src/useAdminDashboard.test.js
```

### **3. Commit Thay Đổi**

```bash
# Commit với message tiếng Việt
git commit -m "Thêm comment test + sửa logic báo cáo"

# Ví dụ chi tiết hơn
git commit -m "feat: Thêm comment tiếng Việt cho tất cả test file

- Comment chi tiết chức năng của từng test case
- Sửa logic báo cáo HTML
- Tối ưu log capture"
```

### **4. Push Lên GitHub**

```bash
# Push branch hiện tại
git push origin main

# Hoặc nếu dùng branch khác
git push origin <tên-branch>
```

### **5. Tạo Pull Request (nếu dùng branch riêng)**

```bash
# B1: Push branch lên
git push origin <tên-branch>

# B2: Vào GitHub → tạo PR từ <tên-branch> → main
```

---

## 📝 Quy Ước Commit Message

```bash
# Format:
git commit -m "type(scope): description"

# Ví dụ:
git commit -m "test(backend): Thêm comment tiếng Việt cho admin.users.test.js"
git commit -m "fix(frontend): Sửa logic báo cáo test"
git commit -m "docs(test): Tạo hướng dẫn chạy test"

# Type: feat, fix, test, docs, refactor, style, chore
```

---

## ⚙️ Cấu Hình Jest

### **Backend Jest Config**

- **File:** `backend/jest.config.js`
- **Test environment:** Node.js
- **Reporter:** Custom HTML reporter

### **Frontend Jest Config**

- **File:** `frontend/jest.config.cjs`
- **Test environment:** jsdom (DOM simulation)
- **Reporter:** Custom HTML reporter (dùng chung với backend)

---

## 🛠️ Các Lệnh Hữu Ích

### **Xóa báo cáo cũ**

```bash
# Backend
rm -r backend/test-reports/
rm -r backend/test-logs/

# Frontend
rm -r frontend/test-reports/
rm -r frontend/test-logs/
```

### **Xem node_modules**

```bash
npm list jest
npm list @jest/globals
```

### **Cập nhật dependencies**

```bash
npm update
npm audit fix
```

### **Clear Jest cache**

```bash
npm test -- --clearCache
```

---

## 📌 Lưu Ý Quan Trọng

✅ **Trước khi push:**

- Chạy test để đảm bảo không có lỗi
- Kiểm tra git status
- Commit message phải rõ ràng

✅ **Khi test fail:**

- Kiểm tra log: `backend/test-logs/npm-test.log` hoặc `frontend/test-logs/jest-test.log`
- Mở báo cáo HTML để xem chi tiết
- Debug và sửa lỗi

✅ **Khi có lỗi merge:**

- Cập nhật branch: `git pull origin main`
- Giải quyết conflict
- Commit lại: `git commit -m "merge: Giải quyết conflict"`

---

## 🔗 Tài Liệu Liên Quan

- **Jest Documentation:** https://jestjs.io/
- **Supertest (HTTP Testing):** https://github.com/visionmedia/supertest
- **React Testing Library:** https://testing-library.com/
- **Git Documentation:** https://git-scm.com/doc

---

**Được tạo:** November 16, 2025
**Dự án:** Bữa Cơm Xanh - QA Testing Guide
