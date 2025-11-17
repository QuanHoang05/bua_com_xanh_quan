````markdown
# Integration Test Guide - Hướng Dẫn Kiểm Tra Tích Hợp

## 📋 Tổng Quan

Integration Tests là các test chạy trực tiếp với database MySQL thực tế, không sử dụng mock data. Các test này kiểm tra toàn bộ flow từ API request đến database response, đảm bảo ứng dụng hoạt động đúng với dữ liệu thực.

## 📁 Cấu Trúc Thư Mục

```
backend/
├── IntegrationTest/
│   ├── auth.integration.test.js              # Test authentication flow
│   ├── admin.metrics.integration.test.js     # Test admin metrics endpoints
│   ├── campaigns.integration.test.js         # Test campaign management
│   ├── users.integration.test.js             # Test user features
│   ├── admin.users.integration.test.js       # Test admin user management
│   ├── integration.bua_com_xanh.real.test.js # Original real integration test
│   ├── extract-test-cases.js                 # Extract test case data
│   └── generate-excel-report.js              # Generate Excel report
├── test/                                       # Unit tests (mock data)
├── src/                                        # Source code
└── test-reports/                              # Generated HTML reports
```

## 🚀 Cách Chạy Integration Tests

### 1. Chạy Tất Cả Integration Tests

```bash
cd backend
npm test -- IntegrationTest/
```

### 2. Chạy Test Suite Cụ Thể

```bash
# Chạy Authentication tests
npm test -- IntegrationTest/auth.integration.test.js

# Chạy Metrics tests
npm test -- IntegrationTest/admin.metrics.integration.test.js

# Chạy Campaigns tests
npm test -- IntegrationTest/campaigns.integration.test.js

# Chạy Users tests
npm test -- IntegrationTest/users.integration.test.js

# Chạy Admin Users tests
npm test -- IntegrationTest/admin.users.integration.test.js

# Chạy original real test
npm test -- IntegrationTest/integration.bua_com_xanh.real.test.js
```

### 3. Chạy Với Output Chi Tiết

```bash
npm test -- IntegrationTest/ --verbose
```

### 4. Chạy Với Coverage Report

```bash
npm test -- IntegrationTest/ --coverage
```

## 🗂️ Chi Tiết Từng Test Suite

### AUTH Integration Tests (5 test cases)

- **AUTH-INT-01**: Register user với dữ liệu hợp lệ
- **AUTH-INT-02**: Login với email và password
- **AUTH-INT-03**: Get current user profile
- **AUTH-INT-04**: Change password
- **AUTH-INT-05**: Login với password mới

**Chạy**:

```bash
npm test -- IntegrationTest/auth.integration.test.js
```

### METRICS Integration Tests (5 test cases)

- **ADMN-MTR-01**: GET delivery success statistics
- **ADMN-MTR-02**: GET heatmap data
- **ADMN-MTR-03**: GET donor statistics
- **ADMN-MTR-04**: GET campaign statistics
- **ADMN-MTR-05**: GET overview metrics

**Chạy**:

```bash
npm test -- IntegrationTest/admin.metrics.integration.test.js
```

### CAMPAIGNS Integration Tests (6 test cases)

- **CAMP-LST-01**: List all campaigns
- **CAMP-DTL-02**: Get campaign details by ID
- **CAMP-FIL-03**: Filter campaigns by status
- **CAMP-DON-04**: Donate to campaign
- **CAMP-SRC-05**: Search campaigns
- **CAMP-SRT-06**: Sort campaigns

**Chạy**:

```bash
npm test -- IntegrationTest/campaigns.integration.test.js
```

### USERS Integration Tests (6 test cases)

- **USER-PRF-01**: Get user profile
- **USER-UPD-02**: Update user profile
- **USER-HIS-03**: Get delivery history
- **USER-DON-04**: Get donation history
- **USER-ACT-05**: Get user activity
- **USER-SET-06**: Update user settings

**Chạy**:

```bash
npm test -- IntegrationTest/users.integration.test.js
```

### ADMIN USERS Integration Tests (7 test cases)

- **ADMN-USR-01**: List all users
- **ADMN-USR-02**: Get user details
- **ADMN-USR-03**: Update user info
- **ADMN-USR-04**: Grant admin role
- **ADMN-USR-05**: Ban user
- **ADMN-USR-06**: Unban user
- **ADMN-USR-07**: Filter users by role

**Chạy**:

```bash
npm test -- IntegrationTest/admin.users.integration.test.js
```

## 🔧 Cấu Hình Database

Integration tests sử dụng các biến môi trường sau (đã được cấu hình mặc định):

```javascript
DB_DRIVER = "mysql";
DB_DATABASE = "bua_com_xanh";
DB_HOST = "127.0.0.1";
DB_PORT = "3306";
DB_USER = "root";
DB_PASSWORD = "";
JWT_SECRET = "test-secret";
```

Nếu cần thay đổi, set các biến trước khi chạy test:

```bash
# Windows PowerShell
$env:DB_HOST = "your-host"
$env:DB_USER = "your-user"
npm test -- IntegrationTest/

# Linux/Mac
export DB_HOST=your-host
export DB_USER=your-user
npm test -- IntegrationTest/
```

## 📊 Sinh Báo Cáo Excel

Integration tests có khả năng sinh báo cáo Excel với tất cả test cases:

```bash
cd backend/IntegrationTest

# Install dependencies (nếu chưa có)
npm install exceljs

# Generate Excel report
node generate-excel-report.js
```

Output: `TEST_REPORT_SUMMARY.xlsx` sẽ được tạo ở thư mục hiện tại

Báo cáo bao gồm:

- **Summary sheet**: Tổng hợp số lượng test cases theo suite
- **Chi tiết từng suite**: Các test case chi tiết với:
  - Test Case ID
  - Endpoint / Function
  - Pre-condition
  - Input / Action
  - Expected Result
  - Status (Passed/Failed)

## 🎯 Best Practices

1. **Chạy trước khi commit**: Đảm bảo tất cả integration tests đều pass
2. **Kiểm tra logs**: Mỗi test in ra chi tiết status và response
3. **Database state**: Nên reset database trước khi chạy full test suite
4. **Test isolation**: Mỗi test tạo data riêng để tránh conflict
5. **Timeout**: Mỗi request có timeout 20 giây, đủ cho DB queries

## ⚠️ Troubleshooting

### Connection refused - Database không kết nối

```bash
# Kiểm tra XAMPP/MySQL server đang chạy
# Windows: Mở XAMPP Control Panel, start MySQL
# Linux: sudo systemctl start mysql
# Mac: brew services start mysql
```

### Tests hang - Requests bị treo

```bash
# Kiểm tra network connection
# Kiểm tra DB user/password
# Xem logs trong test-logs/npm-test.log
```

### Admin token không được - Không thể login as admin

```bash
# Đảm bảo admin@example.com tồn tại trong DB
# Kiểm tra password: admin123
# Hoặc tạo admin user mới bằng seed script
```

## 📝 Logs

Test logs được lưu tại:

```
backend/test-logs/npm-test.log
```

Mỗi test in ra:

- Request status
- Response body (khi error)
- Token information (khi auth)
- Test result ✅ hoặc ❌

## 🔗 Liên Kết Liên Quan

- [Test Guides](../TEST_GUIDE_VI.md)
- [API Testing Guide](./API_TESTING_GUIDE.md)
- [Jest Config](../jest.config.js)
- [Backend README](../README_TESTING.md)

## ❓ FAQ

**Q: Integration tests có ảnh hưởng đến production data không?**
A: Không, tests sử dụng database `bua_com_xanh` với test users riêng biệt

**Q: Bao lâu để chạy hết tất cả integration tests?**
A: ~2-3 phút tùy vào tốc độ server

**Q: Có thể skip một số tests không?**
A: Có, dùng `.skip` hoặc chạy file cụ thể:

```javascript
test.skip("TEST-01: ...", () => { ... })
```

**Q: Làm sao xem detailed error từ failed test?**
A: Kiểm tra console output và file logs `npm-test.log`

---

**Last Updated**: November 2025
**Version**: 1.0
**Status**: ✅ All integration tests documented and ready

```"

```
````
