# 📑 Báo Cáo Công Nghệ Test API (Chuẩn IEEE)

## 1. Mục Đích

Báo cáo này mô tả công nghệ, công cụ và quy trình kiểm thử API cho cả Backend (BE) và Frontend (FE) của dự án Bữa Cơm Xanh, tuân thủ chuẩn IEEE 829 (Standard for Software Test Documentation).

---

## 2. Phạm Vi Áp Dụng

- **Backend:** Node.js, Express, SQLite/MySQL
- **Frontend:** React, Vite, các hook và component liên quan API

---

## 3. Công Nghệ & Công Cụ Sử Dụng

### Backend (API Test)

- **Ngôn ngữ:** JavaScript (ESM)
- **Framework:** Jest (test runner), Supertest (HTTP API test), Mocking (jest.unstable_mockModule)
- **Database:** SQLite, MySQL (mock hoặc test DB)
- **Báo cáo:** Custom HTML Reporter, Báo cáo coverage
- **CI/CD:** GitHub Actions (tự động chạy test khi push)

#### Quy trình test:

- Viết test cho từng route API (CRUD, Auth, Security, Performance...)
- Sử dụng Supertest để gửi request HTTP tới app Express
- Mock database, middleware, external API để kiểm soát kết quả
- Kiểm tra status code, response body, headers, side effect
- Chạy test tự động qua CI/CD

### Frontend (API/Logic Test)

- **Ngôn ngữ:** JavaScript (ESM)
- **Framework:** Jest (test runner), React Testing Library (test UI logic), Mock Service Worker (MSW, nếu cần)
- **Báo cáo:** Custom HTML Reporter, Coverage
- **E2E:** Cypress (test tích hợp giao diện + API)

#### Quy trình test:

- Viết test cho các hook, component có gọi API (useEffect, fetch, axios...)
- Mock API response bằng jest hoặc MSW
- Kiểm tra state, UI, error handling khi API trả về dữ liệu/thất bại
- Chạy test tự động qua CI/CD

---

## 4. Chuẩn IEEE 829 Áp Dụng

- **Test Plan:** Được mô tả trong file README_TESTING.md, TEST_GUIDE_VI.md
- **Test Design Specification:** Mỗi file test mô tả rõ input, expected output, pre-condition
- **Test Case Specification:** Được tổng hợp trong TEST_REPORT_SUMMARY.xlsx
- **Test Log:** Lưu tại test-logs/\*.log, báo cáo HTML
- **Test Incident Report:** Khi có lỗi, log và báo cáo sẽ ghi lại chi tiết
- **Test Summary Report:** Tự động sinh ra sau mỗi lần chạy test (HTML, Excel)

---

## 5. Kết Luận

- Hệ thống test API của BE và FE sử dụng các công nghệ hiện đại, tự động hóa, dễ mở rộng
- Đáp ứng tiêu chuẩn IEEE về tài liệu và quy trình kiểm thử
- Báo cáo test luôn được lưu trữ, dễ truy xuất, minh bạch

---

**Ngày tạo:** 17/11/2025
