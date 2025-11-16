# Test Plan: Bua Com Xanh

| Tên tài liệu | Test Plan dự án Bua Com Xanh |
| --- | --- |
| **Test Plan Identifier** | **BCX_TP_v1.0** |
| Ngày tạo | 11/11/2025 |
| Người tạo | Gemini CLI |
| Version | 1.0 |

---

### 1. Introduction

Tài liệu này mô tả kế hoạch kiểm thử cho dự án "Bua Com Xanh" (phiên bản 1.0). Đây là một hệ thống website hoàn chỉnh bao gồm:
*   **Frontend:** Xây dựng bằng ReactJS, cho phép người dùng (nhà hảo tâm, người nhận, quản trị viên) tương tác với hệ thống.
*   **Backend:** Xây dựng bằng NodeJS và Express, cung cấp các API để xử lý logic nghiệp vụ, quản lý dữ liệu.
*   **Database:** Sử dụng MySQL để lưu trữ toàn bộ dữ liệu của ứng dụng.

Mục tiêu của kế hoạch kiểm thử này là xác định phạm vi, phương pháp, tài nguyên và lịch trình cho các hoạt động kiểm thử, nhằm đảm bảo chất lượng sản phẩm, xác minh các chức năng hoạt động đúng như đặc tả và phát hiện sớm các lỗi tiềm ẩn.

### 2. Test Items

Các hạng mục sẽ được kiểm thử bao gồm:
*   **Backend API:** Toàn bộ các endpoints được định nghĩa trong thư mục `backend/src/routes`.
*   **Database:** Cấu trúc database (schema), các quan hệ (relationships), stored procedures, triggers và tính toàn vẹn dữ liệu trên `bua_com_xanh_test`.
*   **Frontend UI/UX:** Giao diện người dùng trên các trang chính, luồng hoạt động của người dùng, tính tương thích trên các trình duyệt.
*   **Tích hợp Frontend và Backend:** Luồng dữ liệu và tương tác giữa giao diện React và API NodeJS.

### 3. Features to be Tested

*   **F01:** Xác thực người dùng (Đăng ký, Đăng nhập, Đặt lại mật khẩu).
*   **F02:** Quản lý Người dùng (CRUD cho người dùng bởi Admin).
*   **F03:** Quản lý Chiến dịch (Campaigns - CRUD bởi Admin).
*   **F04:** Chức năng Nhà hảo tâm (Donor - Quyên góp, xem lịch sử).
*   **F05:** Chức năng Người nhận (Recipient - Đăng ký nhận suất ăn).
*   **F06:** Chức năng Giao nhận (Delivery/Shipper).
*   **F07:** Báo cáo và Thống kê (Admin Dashboard).
*   **F08:** Báo cáo và Thống kê (Admin Reports).

### 4. Features not to be Tested

*   Kiểm thử hiệu năng (Performance Testing / Load Testing).
*   Kiểm thử bảo mật sâu (Penetration Testing).
*   Kiểm thử tính khả dụng chi tiết (Detailed Usability Testing).
*   Kiểm thử các dịch vụ bên thứ ba (VD: Momo, VietQR) ở môi trường production.

### 5. Approach

*   **Backend Testing (API & Database):**
    *   **Kiểm thử tự động (Automated Testing):** Sử dụng **Jest** và **Supertest** để thực hiện integration testing cho các API endpoint. Các test case sẽ tạo HTTP request đến server, sau đó xác minh HTTP response (status code, body).
    *   Các test sẽ kết nối đến một database riêng biệt (`bua_com_xanh_test`) được khởi tạo với dữ liệu giả (fake data) trước mỗi lần chạy test để đảm bảo môi trường test sạch và độc lập.
    *   Thư viện `mysql2` sẽ được dùng để kiểm tra trực tiếp trạng thái của dữ liệu trong database sau khi thực hiện các API call (VD: kiểm tra record đã được tạo/cập nhật/xóa thành công chưa).

*   **Frontend Testing (Manual):**
    *   **Kiểm thử thủ công (Manual Testing):** Dựa trên các test case được định nghĩa trong tài liệu `TestCases.md`, tester sẽ thực hiện các thao tác trên giao diện người dùng để kiểm tra luồng chức năng, hiển thị UI, và sự tương tác với backend.
    *   **Kiểm thử tương thích (Compatibility Testing):** Kiểm tra hoạt động của ứng dụng trên các trình duyệt phổ biến (Chrome, Firefox phiên bản mới nhất).

### 6. Pass/Fail Criteria

*   **Pass:** 100% các test case có độ ưu tiên "High" phải thành công. >95% các test case "Medium" thành công.
*   **Fail:** Bất kỳ test case "High" nào thất bại. >5% test case "Medium" thất bại. Xuất hiện lỗi nghiêm trọng (critical bug) làm sập ứng dụng hoặc sai lệch dữ liệu nghiêm trọng.

### 7. Suspension Criteria and Resumption Requirements

*   **Tạm dừng (Suspension):**
    *   Khi phát hiện lỗi nghiêm trọng (blocker/critical) ngăn cản việc kiểm thử các chức năng khác.
    *   Môi trường test (server, database) không ổn định hoặc không sẵn sàng.
    *   Build mới không đáp ứng được các yêu cầu cơ bản để bắt đầu test (smoke test thất bại).
*   **Tiếp tục (Resumption):**
    *   Lỗi nghiêm trọng đã được khắc phục và xác minh.
    *   Môi trường test đã ổn định trở lại.

### 8. Test Deliverables

*   **Test Plan:** Tài liệu này (`TestPlan.md`).
*   **Test Cases:** Tài liệu mô tả các trường hợp kiểm thử (`TestCases.md`).
*   **Test Scripts:** Mã nguồn kiểm thử tự động trong thư mục `backend/__tests__/`.
*   **Test Data:** Script SQL để tạo dữ liệu cho database test (`backend/data/seed_test_db.sql`).
*   **Test Summary Report:** (Tùy chọn) Báo cáo tổng kết kết quả sau mỗi chu kỳ test.

### 9. Testing Tasks & Responsibilities

| Nhiệm vụ | Người chịu trách nhiệm |
| --- | --- |
| Viết Test Plan, Test Cases | Gemini CLI |
| Chuẩn bị môi trường test, dữ liệu test | Developer / Gemini CLI |
| Viết code test tự động (API) | Gemini CLI |
| Thực thi test thủ công (Frontend) | Tester / Developer |
| Báo cáo lỗi | Tester / Developer |
| Sửa lỗi | Developer |

### 10. Test Environment

| Hạng mục | Yêu cầu |
| --- | --- |
| **Hardware** | PC/Laptop (Windows/macOS/Linux) |
| **Trình duyệt** | Chrome (phiên bản mới nhất), Firefox (phiên bản mới nhất) |
| **Backend Runtime** | NodeJS v18.x hoặc mới hơn |
| **Web Server** | XAMPP |
| **Database** | MySQL 8.x (từ XAMPP) |
| **Testing Framework** | Jest, Supertest |

### 11. Schedule & Risks

*   **Lịch trình:**
    *   Tuần 1: Hoàn thành Test Plan, Test Cases, và kịch bản test tự động cho các chức năng chính.
    *   Tuần 2: Thực thi test, báo cáo lỗi.
    *   Tuần 3: Kiểm thử hồi quy (regression testing) sau khi sửa lỗi.
*   **Rủi ro:**
    *   **R1:** Thời gian thực hiện dự án có hạn, có thể không bao phủ hết 100% test case. (Giảm thiểu: Ưu tiên test các chức năng quan trọng).
    *   **R2:** Yêu cầu chức năng thay đổi vào phút chót, ảnh hưởng đến test case và script. (Giảm thiểu: Cập nhật lại tài liệu test và script tương ứng).
    *   **R3:** Môi trường test không đồng nhất với môi trường production. (Giảm thiểu: Cố gắng cấu hình môi trường test gần giống production nhất có thể).
