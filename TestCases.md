# Test Cases - Bua Com Xanh

Đây là tài liệu mô tả các trường hợp kiểm thử cho dự án Bua Com Xanh.

**Cấu trúc Test Case:**
*   **Test Case ID:** Mã định danh duy nhất.
*   **Test Scenario:** Mô tả kịch bản hoặc chức năng được kiểm thử.
*   **Test Steps:** Các bước chi tiết để thực hiện test.
*   **Test Data:** Dữ liệu cần thiết để thực hiện test.
*   **Expected Result:** Kết quả mong đợi sau khi thực hiện.
*   **Actual Result:** Kết quả thực tế (để trống).
*   **Status:** Trạng thái (Pass/Fail - để trống).
*   **Priority:** Độ ưu tiên (High, Medium, Low).

---

### Phần 1: Xác thực người dùng (Authentication)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BCX_AUTH_001** | Đăng nhập thành công với tài khoản hợp lệ | 1. Mở trang Đăng nhập.<br>2. Nhập email và mật khẩu đúng.<br>3. Nhấn nút "Đăng nhập". | Email: `admin@bua.com`<br>Password: `admin123` | 1. Hệ thống chuyển hướng đến trang Dashboard (Admin) hoặc trang chủ.<br>2. Hiển thị thông báo đăng nhập thành công.<br>3. Tên người dùng được hiển thị trên header. | | | High |
| **BCX_AUTH_002** | Đăng nhập thất bại với mật khẩu sai | 1. Mở trang Đăng nhập.<br>2. Nhập email đúng và mật khẩu sai.<br>3. Nhấn nút "Đăng nhập". | Email: `admin@bua.com`<br>Password: `wrongpassword` | 1. Hệ thống không chuyển trang.<br>2. Hiển thị thông báo lỗi "Email hoặc mật khẩu không chính xác". | | | High |
| **BCX_AUTH_003** | Đăng nhập thất bại với email không tồn tại | 1. Mở trang Đăng nhập.<br>2. Nhập email không có trong hệ thống.<br>3. Nhấn nút "Đăng nhập". | Email: `nonexistent@user.com`<br>Password: `123456` | 1. Hệ thống không chuyển trang.<br>2. Hiển thị thông báo lỗi "Email hoặc mật khẩu không chính xác". | | | Medium |
| **BCX_AUTH_004** | Đăng ký tài khoản thành công | 1. Mở trang Đăng ký.<br>2. Điền đầy đủ thông tin hợp lệ.<br>3. Nhấn nút "Đăng ký". | Tên: `Test User`<br>Email: `testuser_` + timestamp + `@example.com`<br>Password: `password123` | 1. Hệ thống chuyển hướng đến trang Đăng nhập hoặc trang xác thực OTP.<br>2. Hiển thị thông báo đăng ký thành công. | | | High |
| **BCX_AUTH_005** | Đăng ký thất bại với email đã tồn tại | 1. Mở trang Đăng ký.<br>2. Điền thông tin với email đã được sử dụng.<br>3. Nhấn nút "Đăng ký". | Email: `admin@bua.com`<br>Password: `password123` | 1. Hệ thống không chuyển trang.<br>2. Hiển thị thông báo lỗi "Email này đã được sử dụng". | | | Medium |

---

### Phần 2: Quản lý Người dùng (Admin)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BCX_ADMIN_USER_001** | Admin xem danh sách người dùng | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Người dùng". | Tài khoản: `admin@bua.com` / `admin123` | 1. Hiển thị một bảng/danh sách chứa thông tin của tất cả người dùng trong hệ thống (ID, Tên, Email, Vai trò, Trạng thái). | | | High |
| **BCX_ADMIN_USER_002** | Admin tìm kiếm người dùng theo email | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Người dùng".<br>3. Nhập email của một người dùng vào ô tìm kiếm.<br>4. Nhấn Enter hoặc nút tìm kiếm. | Email: `donor1@bua.com` | 1. Danh sách người dùng được lọc lại và chỉ hiển thị người dùng có email tương ứng. | | | Medium |
| **BCX_ADMIN_USER_003** | Admin vô hiệu hóa tài khoản người dùng | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Người dùng".<br>3. Tìm một người dùng đang hoạt động.<br>4. Nhấn vào nút "Vô hiệu hóa" (Disable/Deactivate).<br>5. Xác nhận hành động. | User ID cần vô hiệu hóa. | 1. Trạng thái của người dùng trong danh sách chuyển thành "Vô hiệu hóa".<br>2. Người dùng đó không thể đăng nhập vào hệ thống được nữa. | | | High |

---

### Phần 3: Quản lý Chiến dịch (Admin)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BCX_ADMIN_CAMP_001** | Admin xem danh sách chiến dịch | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Chiến dịch". | Tài khoản: `admin@bua.com` / `admin123` | 1. Hiển thị danh sách các chiến dịch đã tạo với các thông tin cơ bản (Tên, Ngày bắt đầu, Ngày kết thúc, Trạng thái). | | | High |
| **BCX_ADMIN_CAMP_002**
 | Admin tạo một chiến dịch mới thành công | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Chiến dịch".<br>3. Nhấn nút "Tạo mới".<br>4. Điền đầy đủ thông tin hợp lệ vào form.<br>5. Nhấn nút "Lưu". | Tên: `Chiến dịch Tết 2026`<br>Mô tả: `Quyên góp cho người vô gia cư`<br>Ngày bắt đầu: `01/01/2026`<br>Ngày kết thúc: `15/01/2026` | 1. Hệ thống hiển thị thông báo "Tạo chiến dịch thành công".<br>2. Chiến dịch mới xuất hiện trong danh sách chiến dịch. | | | High |
| **BCX_ADMIN_CAMP_003** | Admin tạo chiến dịch mới thất bại (dữ liệu không hợp lệ) | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Chiến dịch".<br>3. Nhấn nút "Tạo mới".<br>4. Để trống trường "Tên chiến dịch".<br>5. Nhấn nút "Lưu". | Tên: (để trống) | 1. Hệ thống hiển thị thông báo lỗi tại trường "Tên chiến dịch" (VD: "Tên chiến dịch không được để trống").<br>2. Chiến dịch không được tạo. | | | Medium |
| **BCX_ADMIN_CAMP_004** | Admin chỉnh sửa một chiến dịch | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Chiến dịch".<br>3. Chọn một chiến dịch và nhấn nút "Sửa".<br>4. Thay đổi mô tả của chiến dịch.<br>5. Nhấn nút "Lưu". | Mô tả mới: `Mô tả đã được cập nhật` | 1. Hệ thống hiển thị thông báo "Cập nhật thành công".<br>2. Thông tin của chiến dịch trong danh sách được cập nhật. | | | High |
| **BCX_ADMIN_CAMP_005** | Admin xóa một chiến dịch | 1. Đăng nhập với tài khoản Admin.<br>2. Điều hướng đến trang "Quản lý Chiến dịch".<br>3. Chọn một chiến dịch và nhấn nút "Xóa".<br>4. Xác nhận hành động xóa. | ID chiến dịch cần xóa. | 1. Hệ thống hiển thị thông báo "Xóa thành công".<br>2. Chiến dịch đó biến mất khỏi danh sách. | | | High |

---

### Phần 4: Báo cáo (Admin)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BCX_ADMIN_RPT_001** | Admin xem báo cáo tổng quan | 1. Đăng nhập với tài khoản Admin.<br>2. Gọi API `GET /api/admin/reports/overview`. | Tài khoản: `admin@bua.com` / `admin123` | 1. API trả về status `200 OK`.<br>2. Dữ liệu trả về chứa các trường thống kê chính như `total_users`, `total_donations`. | | | High |
| **BCX_ADMIN_RPT_002** | User thường không thể xem báo cáo của Admin | 1. Đăng nhập với tài khoản Donor.<br>2. Gọi API `GET /api/admin/reports/overview`. | Tài khoản: `donor1@bua.com` / `donor123` | 1. API trả về status `403 Forbidden`. | | | High |

---

### Phần 5: Import Dữ liệu (Admin)

| Test Case ID | Test Scenario | Test Steps | Test Data | Expected Result | Actual Result | Status | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BCX_ADMIN_IMPORT_001** | Admin import giao dịch thành công từ file Excel hợp lệ | 1. Đăng nhập với tài khoản Admin.<br>2. Gọi API `POST /api/admin/payments/import` với một file Excel có đủ các cột `code`, `amount`, `paid_at`, `donor_name`, `campaign_id`. | File Excel hợp lệ. | 1. API trả về status `200 OK`.<br>2. Thông báo "Import thành công X giao dịch.".<br>3. Dữ liệu được chèn đúng vào database. | | | High |
| **BCX_ADMIN_IMPORT_002** | Admin import thất bại khi file thiếu cột bắt buộc | 1. Đăng nhập với tài khoản Admin.<br>2. Gọi API `POST /api/admin/payments/import` với một file Excel thiếu cột `code`. | File Excel thiếu header. | 1. API trả về status `400 Bad Request`.<br>2. Thông báo lỗi "File Excel thiếu các cột bắt buộc: code...". | | | High |
| **BCX_ADMIN_IMPORT_003** | Admin import thất bại khi tải lên file không phải Excel | 1. Đăng nhập với tài khoản Admin.<br>2. Gọi API `POST /api/admin/payments/import` với một file `.txt`. | File `test.txt`. | 1. API trả về status `400 Bad Request`.<br>2. Thông báo lỗi "Chỉ cho phép file Excel (.xlsx, .xls)!". | | | Medium |
| **BCX_ADMIN_IMPORT_004** | User thường không thể import giao dịch | 1. Đăng nhập với tài khoản Donor.<br>2. Gọi API `POST /api/admin/payments/import` với một file Excel. | File Excel hợp lệ. | 1. API trả về status `403 Forbidden`. | | | High |
