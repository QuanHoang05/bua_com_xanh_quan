# 🎯 Hướng Dẫn Chạy Test & Xem Báo Cáo

## Backend

### Chạy Test và Tạo Báo Cáo

```bash
cd backend
npm run test:report
```

Lệnh này sẽ:

- ✅ Chạy tất cả 210+ test cases
- 📊 Tạo báo cáo HTML trong thư mục `test-reports/`
- 📅 Mỗi lần chạy sẽ tạo file mới với timestamp

### Mở Báo Cáo Mới Nhất

```bash
npm run open:report
```

Lệnh này sẽ:

- 🌐 Mở file HTML báo cáo mới nhất tự động trong trình duyệt
- ✨ Hỗ trợ Windows, macOS, Linux

### Xem Chi Tiết Báo Cáo

Báo cáo HTML hiển thị:

| Cột                      | Nội Dung                         |
| ------------------------ | -------------------------------- |
| **ID Kiểm Thử**          | TC-1-1, TC-1-2, ...              |
| **Bộ Kiểm Thử**          | auth.test.js, users.test.js, ... |
| **Tên Kiểm Thử**         | "Should register new user", ...  |
| **Điều Kiện Tiên Quyết** | Điều kiện ban đầu của test       |
| **Dữ Liệu Nhập**         | Input dữ liệu test               |
| **Kết Quả Mong Muốn**    | Expected result                  |
| **Trạng Thái**           | ✅ Pass / ❌ Fail                |
| **Thời Gian**            | Thời gian thực thi (ms)          |

### Thống Kê Báo Cáo

Báo cáo cũng hiển thị:

- 📈 Tỷ lệ thành công (%)
- 📊 Tổng số test, pass, fail
- ⏱️ Thời gian thực thi tổng cộng
- 📅 Thời gian tạo báo cáo

---

## Frontend

### Chạy Test và Tạo Báo Cáo

```bash
cd frontend
npm run test:report
```

### Mở Báo Cáo Mới Nhất

```bash
npm run open:report
```

---

## Mẹo Sử Dụng

### 1. Chạy Test + Mở Báo Cáo Liên Tục

```bash
# Backend
npm run test:report && npm run open:report

# Frontend
npm run test:report && npm run open:report
```

### 2. Xem Thư Mục Báo Cáo

```bash
# Backend
ls -la backend/test-reports/

# Frontend
ls -la frontend/test-reports/
```

### 3. Tìm File HTML Mới Nhất

File báo cáo được đặt tên theo timestamp:

- Format: `test-report-2025-11-16T08-11-29.html`
- Tự động sắp xếp theo thời gian
- Lệnh `npm run open:report` tự động tìm file mới nhất

---

## Cấu Trúc Báo Cáo HTML

### Phần Header

- 🎨 Gradient màu tím-xanh đẹp mắt
- 📱 Responsive trên mọi thiết bị

### Phần Thống Kê (Stats Grid)

4 thẻ thống kê:

- 🔵 Tổng Kiểm Thử
- 🟢 Thành Công
- 🔴 Thất Bại
- 🟡 Thời Gian

### Phần Tỷ Lệ

- Progress bar hiển thị % thành công
- Badges chỉ số Pass/Fail

### Phần Chi Tiết

- Bảng danh sách tất cả test cases
- Hàng được tô màu xanh (pass) hoặc đỏ (fail)
- Hover effect để dễ theo dõi

### Phần Footer

- Thông tin tạo báo cáo
- ISO timestamp

---

## Khắc Phục Sự Cố

### Lệnh open:report không mở trình duyệt

**Giải pháp:**
Mở file HTML thủ công từ thư mục:

- Backend: `backend/test-reports/test-report-*.html`
- Frontend: `frontend/test-reports/test-report-*.html`

### Không tìm thấy file báo cáo

**Kiểm tra:**

```bash
# Backend
test -d backend/test-reports && echo "OK" || echo "Không tìm thấy"

# Frontend
test -d frontend/test-reports && echo "OK" || echo "Không tìm thấy"
```

### Báo cáo HTML không hiển thị đúng

**Nguyên nhân:** Trình duyệt không hỗ trợ CSS Grid hoặc JavaScript
**Giải pháp:**

- Cập nhật trình duyệt
- Thử trình duyệt khác (Chrome, Firefox, Safari, Edge)

---

## Lịch Sử Báo Cáo

Mỗi lần chạy test tạo một file báo cáo mới:

```
test-reports/
├── test-report-2025-11-16T07-59-48.html   (Lần 1)
├── test-report-2025-11-16T08-00-01.html   (Lần 2)
├── test-report-2025-11-16T08-11-29.html   (Lần 3 - mới nhất)
```

💡 **Lợi ích:** Giữ lịch sử test, so sánh hiệu suất qua thời gian

---

## Tích Hợp CI/CD

Báo cáo HTML được tạo tự động khi:

- ✅ Chạy `npm run test:report` cục bộ
- ✅ GitHub Actions chạy test (nếu setup)
- ✅ Bất kỳ pipeline CI nào chạy test

Có thể upload artifacts lên GitHub Actions để xem:

```yaml
- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: test-reports
    path: |
      backend/test-reports/
      frontend/test-reports/
```

---

**Tổng Kết:**

```bash
# Workflow cơ bản:
npm run test:report  # Chạy test + tạo báo cáo
npm run open:report  # Mở báo cáo trong trình duyệt

# Hoặc 1 lệnh:
npm run test:report && npm run open:report
```
