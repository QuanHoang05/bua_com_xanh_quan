# Hướng dẫn báo cáo Integration Tests (tự động)

Tệp `test-report.html` được tạo tự động bởi `IntegrationTest/runner.js` sau khi chạy test.

- Vị trí file HTML: `backend/test-report.html`
- Route để xem nhanh (khi server đang chạy): `GET /test-report`
  - Khởi động API server (từ thư mục `backend`):

```powershell
# Windows PowerShell
node src/server.js
# Sau đó mở trình duyệt: http://localhost:4000/test-report
```

Mô tả quy trình tự động:

- `IntegrationTest/runner.js` chạy từng suite test (ví dụ: `campaigns`), và nếu có lỗi nó sẽ ghi `IntegrationTest/errorIntegration.md`.
- Sau khi kết thúc, runner gọi `src/lib/reportGenerator.js` để tổng hợp `errorIntegration.md` và bất kỳ file trong `IntegrationTest/test-reports/` thành `test-report.html`.
- Route `GET /test-report` (đã được mount) sẽ trả về file `test-report.html` nếu tồn tại.

Ghi chú tiếng Việt:

- Tôi đã thêm module `reportGenerator` và route `testReport` để bạn có thể xem báo cáo nhanh bằng trình duyệt.
- Một số tài liệu cũ trong `IntegrationTest` đã được chuyển vào `IntegrationTest/archived-md/` để tránh trùng lặp. Nếu bạn muốn xóa hẳn, tôi có thể xóa các file đó theo danh sách.

Các lệnh hữu ích:

```powershell
# Chạy campaign suite và tạo báo cáo HTML
node IntegrationTest/runner.js campaigns -v

# Chạy toàn bộ suites
node IntegrationTest/runner.js all -v

# Mở server để xem báo cáo
node src/server.js
# sau đó truy cập
# http://localhost:4000/test-report
```

Nếu bạn muốn tôi tự động mở trình duyệt sau khi chạy runner, tôi có thể thêm tuỳ chọn `--open` để gọi `start` (Windows) hoặc `open` (Mac).
