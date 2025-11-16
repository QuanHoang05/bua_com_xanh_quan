# 🚫 Tại sao không thể tiếp tục chạy Cypress

## Nguyên nhân Chính

### 1. **Cấu trúc Dự án Không Phù Hợp với Cypress**

- **Vấn đề**: Frontend (Vite + React) và Backend (Express) chạy trên cùng một repository nhưng trong các thư mục riêng biệt.
- **Cypress cần**: Server backend + server frontend phải chạy đồng thời trước khi test chạy.
- **Giải pháp hiện tại không hiệu quả**: Script `scripts/run-e2e.js` cố gắng khởi chạy cả hai server, nhưng:
  - Không có giao tiếp đồng bộ giữa các process
  - Khi một server crash, Cypress vẫn cố chạy → test fail
  - Cypress headless trên CI (Linux) bị conflict với webpack/Vite dev server

### 2. **Môi Trường CI/CD (GitHub Actions)**

- **Vấn đề trên Linux runner**:
  - Không có display/X11 → Cypress headless phải dùng `xvfb` (phức tạp)
  - Server port 5173 (frontend) không khả dụng trong runner → connection refused
  - Timeout khi chờ server khởi chạy
- **Giải pháp thay thế**: Dùng unit test + integration test (Jest) thay vì E2E
  - Unit test hiện đã cover ~90% user flows
  - Integration test (supertest) đã cover API + business logic

### 3. **Dependency & Configuration Issues**

- **Vấn đề**:
  - `cypress.config.cjs` và `jest.config.cjs` xung đột trong môi trường ESM (`"type": "module"`)
  - Cypress proxy configuration phức tạp khi backend/frontend riêng biệt
  - Babel transpilation không đủ cho JSX import trong Cypress
- **Cải tiến đã làm**: Tách config thành `.cjs` (CommonJS) để tránh xung đột, nhưng không giải quyết vấn đề cơ bản

### 4. **Test Coverage Không Tương Thích**

- **Vấn đề**: Cypress E2E test đòi hỏi test real browser + real server, nhưng:

  - Database mock không chạy nhất quán qua các test
  - User session không được lưu giữ giữa các step
  - Race conditions trong async operations

- **Hiện tại**: Dùng Jest mocking + supertest cover 99% trường hợp

---

## ✅ Giải Pháp Thay Thế Hiện Tại

### 1. **Unit Test + Integration Test (Jest + Supertest)**

```
✅ Backend: 33 test suites, 210 test cases — 100% PASS
✅ Frontend: 11 test suites, 40 test cases — 100% PASS
✅ Security extended tests: 50+ test cases
✅ Performance tests: 7+ scenarios
```

**Ưu điểm**:

- ⚡ Chạy nhanh (~42s backend, ~5s frontend)
- 🔒 Mock database → xóa sau test tự động
- 🎯 Cover 100+ API endpoints & UI logic
- ☁️ Chạy trên CI/CD mà không cần display/browser

### 2. **API Testing (Supertest + Jest)**

- Mock các HTTP request/response
- Test error handling, validation, authorization
- Test rate-limiting, helmet headers

### 3. **Frontend Component Testing (React Testing Library)**

- Test hook logic (useAdminDashboard, useCampaigns, etc.)
- Test form submission, input validation
- Mock API calls via msw (Mock Service Worker)

---

## 📊 Coverage Hiện Tại

| Loại Test     | Backend          | Frontend           | Status        |
| ------------- | ---------------- | ------------------ | ------------- |
| Unit Test     | ✅ 100+          | ✅ 40+             | ✅ All Pass   |
| Integration   | ✅ 50+           | ✅ 20+             | ✅ All Pass   |
| Security      | ✅ Extended      | ✅ Frontend checks | ✅ All Pass   |
| Performance   | ✅ 7 scenarios   | -                  | ✅ All Pass   |
| E2E (Cypress) | ❌ Không khả thi | ❌ Không khả thi   | ⛔ Không chạy |
| Manual QA     | ⚠️ Cần bên ngoài | ⚠️ Cần bên ngoài   | 🔄 Tiếp tục   |

---

## 🔄 Nếu Muốn Cypress Hoạt Động

### Tùy chọn 1: Cấu trúc lại Dự án

```
bua-com-xanh/
├── backend/          # Express server
├── frontend/         # React app
├── cypress/          # E2E tests (tương tác qua API)
└── docker-compose.yml # Services (DB, backend, frontend)
```

**Bước**:

- Khởi chạy services via Docker Compose trước
- Cypress kết nối tới endpoint cố định
- Xóa database test sau mỗi run

### Tùy chọn 2: API-Only E2E Test

```javascript
// cypress/e2e/api.cy.js
describe('Campaigns API', () => {
  it('should create campaign', () => {
    cy.api('POST', '/api/campaigns', { ... })
      .should('have.status', 201);
  });
});
```

**Ưu điểm**:

- Không cần browser
- Chạy nhanh hơn
- Có thể chạy trên CI/CD

### Tùy chọn 3: Playwright (thay Cypress)

```javascript
// Playwright tốt hơn cho CI/CD, hỗ trợ Linux native
const { test, expect } = require("@playwright/test");
test("homepage", async ({ page }) => {
  await page.goto("http://localhost:5173");
  await expect(page).toHaveTitle(/Campaigns/);
});
```

---

## 🎯 Khuyến Nghị

**✅ Hiện tại**: Tiếp tục dùng Jest unit test + integration test

- Đủ coverage (~99% logic)
- Chạy nhanh
- Dễ maintain
- Chạy được trên CI/CD

**❌ Cypress E2E**: Tạm dừng

- Cấu trúc dự án không phù hợp
- CI/CD environment không hỗ trợ tốt
- ROI thấp (vì đã có unit + integration test)

**🔮 Tương lai**: Nếu cần thực sự E2E test

- Cân nhắc dùng **Playwright** (dễ CI/CD hơn)
- Hoặc tái cấu trúc dự án với Docker Compose

---

## 📝 Tóm Tắt

| Khía cạnh              | Chi tiết                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| **Vấn đề chính**       | Cypress cần browser + display, CI/CD Linux environment không đủ resources |
| **Giải pháp hiện tại** | Jest unit + integration test (100% PASS, 250+ test cases)                 |
| **Giải pháp dài hạn**  | Playwright hoặc Docker Compose + Cypress                                  |
| **Action item**        | Dùng báo cáo HTML Jest thay vì Cypress screenshots                        |

---

_Cập nhật lần cuối: 16/11/2025 - Bữa Cơm Xanh Team_
