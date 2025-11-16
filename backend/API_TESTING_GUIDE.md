# 🧪 API Testing Guide - Hướng dẫn Kiểm thử API Toàn diện

## 📚 Giới thiệu

Bộ test này cung cấp kiểm thử toàn diện cho API với **4 bộ test chính** bao gồm:

1. **Security Tests** - Kiểm tra bảo mật
2. **Performance Tests** - Kiểm tra hiệu suất
3. **Integration Tests** - Kiểm tra tích hợp
4. **Data Validation Tests** - Kiểm tra xác thực dữ liệu

---

## 🚀 Cách chạy Test

### 1. Chạy tất cả test

```bash
npm test
```

### 2. Chạy test cụ thể

```bash
# Chạy security tests
npm test -- security.test.js

# Chạy performance tests
npm test -- performance.test.js

# Chạy integration tests
npm test -- api.integration.test.js

# Chạy data validation tests
npm test -- data.validation.test.js
```

### 3. Chạy test theo pattern

```bash
# Kiểm thử SQL Injection
npm test -- --testNamePattern="SQL Injection"

# Kiểm thử Response Time
npm test -- --testNamePattern="Response Time"

# Kiểm thử CRUD Operations
npm test -- --testNamePattern="CRUD"
```

### 4. Chạy test với coverage

```bash
# Coverage report cho tất cả
npm test -- --coverage

# Coverage cho file cụ thể
npm test -- security.test.js --coverage
```

### 5. Chạy test ở chế độ watch

```bash
# Tự động chạy lại khi file thay đổi
npm test -- --watch

# Watch chỉ một file
npm test -- security.test.js --watch
```

### 6. Chạy test với verbose output

```bash
npm test -- --verbose
```

### 7. Chạy test song song/tuần tự

```bash
# Chạy song song (mặc định)
npm test -- --maxWorkers=4

# Chạy tuần tự
npm test -- --maxWorkers=1
```

---

## 📊 Test Suites Chi Tiết

### Security Tests (24 test cases)

#### Test 1: SQL Injection Prevention

```bash
npm test -- --testNamePattern="SQL Injection"
```

**Kiểm thử:**

- ✅ Input với SQL injection: `'; DROP TABLE users; --`
- ✅ Special characters escaping
- ✅ Numeric injection: `1 OR 1=1`

**Expected**: API should handle safely, không execute SQL malicious

---

#### Test 2: Authentication & Token Security

```bash
npm test -- --testNamePattern="Authentication"
```

**Kiểm thử:**

- ✅ Request không token → 401
- ✅ Malformed token → 401
- ✅ Expired token → 401
- ✅ Valid token → Accept
- ✅ Wrong secret token → 401
- ✅ Invalid header format → 401

**Example:**

```bash
# Test without token
curl -X GET http://localhost:4000/api/admin/announcements

# Test with token
curl -X GET http://localhost:4000/api/admin/announcements \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### Test 3: Role-Based Access Control

```bash
npm test -- --testNamePattern="Role-Based"
```

**Kiểm thử:**

- ✅ User role không access admin endpoints → 403
- ✅ Admin role access admin endpoints → 200
- ✅ Prevent privilege escalation

---

#### Test 4: Input Validation

```bash
npm test -- --testNamePattern="Input Validation"
```

**Kiểm thử:**

- ✅ Oversized JSON payload → 413
- ✅ Null/undefined values → Handled safely
- ✅ Email format validation
- ✅ XSS payloads: `<script>alert('XSS')</script>` → Escaped

---

### Performance Tests (17 test cases)

#### Test 1: Response Time

```bash
npm test -- --testNamePattern="Response Time"
```

**Metrics:**

- GET: < 100ms ✅
- POST: < 200ms ✅
- PATCH: < 200ms ✅
- DELETE: < 200ms ✅

**Console Output:**

```
📊 GET response time: 25ms
📊 POST response time: 45ms
📊 PATCH response time: 38ms
📊 DELETE response time: 30ms
```

---

#### Test 2: Concurrent Requests

```bash
npm test -- --testNamePattern="Concurrent"
```

**Kiểm thử:**

- ✅ 10 concurrent requests
- ✅ 50 concurrent requests
- ✅ Mixed operations (GET, POST, PATCH, DELETE)

**Console Output:**

```
📊 10 concurrent requests completed in 150ms
📊 50 concurrent requests - Success rate: 100%
📊 Mixed operations (20 total): 20 completed in 200ms
```

---

#### Test 3: Memory Usage

```bash
npm test -- --testNamePattern="Memory"
```

**Kiểm thử:**

- ✅ 100 repeated requests
- ✅ Check for memory leaks

**Console Output:**

```
📊 Memory increase after 100 requests: 2.5MB
```

---

#### Test 4: Database Query Performance

```bash
npm test -- --testNamePattern="Query Performance"
```

**Kiểm thử:**

- ✅ Efficient query patterns
- ✅ No N+1 queries

---

### Integration Tests (19 test cases)

#### Test 1: CRUD Workflow

```bash
npm test -- --testNamePattern="CRUD"
```

**Test Flow:**

```
1. Create (POST) → 201
2. Read (GET) → 200
3. Update (PATCH) → 200
4. Delete (DELETE) → 200
```

**Example:**

```bash
# Create
curl -X POST http://localhost:4000/api/admin/announcements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test","content":"Content"}'

# Read
curl -X GET http://localhost:4000/api/admin/announcements \
  -H "Authorization: Bearer $TOKEN"

# Update
curl -X PATCH http://localhost:4000/api/admin/announcements/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Updated"}'

# Delete
curl -X DELETE http://localhost:4000/api/admin/announcements/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Test 2: Pagination & Filtering

```bash
npm test -- --testNamePattern="Pagination"
```

**Test Parameters:**

```javascript
// Pagination
/api/admin/announcements?page=1&limit=10

// Filtering
/api/admin/announcements?level=high&active=1

// Sorting
/api/admin/announcements?sort=title&order=asc
```

---

#### Test 3: Batch Operations

```bash
npm test -- --testNamePattern="Batch"
```

**Kiểm thử:**

- Batch create multiple records
- Batch delete multiple records

---

### Data Validation Tests (23 test cases)

#### Test 1: Required Fields

```bash
npm test -- --testNamePattern="Required Fields"
```

**Invalid Payloads:**

```javascript
{
} // Missing all
{
  content: "Only content";
} // Missing title
{
  title: "Only title";
} // Missing content
```

---

#### Test 2: String Constraints

```bash
npm test -- --testNamePattern="String Length"
```

**Test Cases:**

```javascript
"A".repeat(10000); // Too long
"A".repeat(100); // OK
(""); // Empty string
```

---

#### Test 3: Email Validation

```bash
npm test -- --testNamePattern="Email"
```

**Invalid Emails:**

```javascript
"notanemail";
"@example.com";
"user@";
"user name@example.com";
```

**Valid Emails:**

```javascript
"user@example.com";
"test.user@example.co.uk";
"user+tag@example.com";
```

---

#### Test 4: Date Validation

```bash
npm test -- --testNamePattern="Date"
```

**Invalid Dates:**

```javascript
"2024-13-01"; // Invalid month
"2024-12-32"; // Invalid day
"invalid-date";
```

---

## 📈 Coverage Report

### Tạo Coverage Report

```bash
npm test -- --coverage
```

### Output Example:

```
File           | % Stmts | % Branch | % Funcs | % Lines
───────────────┼─────────┼──────────┼─────────┼─────────
All files      |   85.2  |   78.9   |   82.1  |   85.5
src/routes/    |   88.5  |   81.2   |   85.3  |   88.9
src/lib/       |   82.1  |   76.5   |   79.8  |   82.3
```

---

## 🔧 Debugging Tests

### 1. Xem chi tiết test failure

```bash
npm test -- security.test.js --verbose --no-coverage
```

### 2. Dùng debugger

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand security.test.js
```

### 3. Log chi tiết

```javascript
// Thêm vào test file
beforeEach(() => {
  console.log("=== Starting test ===");
});

test("example", async () => {
  console.log("Test input:", testData);
  const res = await request(app).get(...);
  console.log("Response:", res.body);
  expect(res.statusCode).toBe(200);
});
```

---

## 🎯 Best Practices

### 1. Test Structure

```javascript
describe("Feature Name", () => {
  beforeAll(() => {
    // Setup once
  });

  beforeEach(() => {
    // Cleanup before each test
    jest.clearAllMocks();
  });

  test("should do something", async () => {
    // Arrange
    const input = {...};

    // Act
    const result = await action(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### 2. Naming Convention

```javascript
// ❌ Bad
test("test", () => {});
test("1", () => {});

// ✅ Good
test("should reject request without token", async () => {});
test("should handle oversized JSON payload", async () => {});
```

### 3. Assertions

```javascript
// ❌ Bad
expect(response).toBeTruthy();

// ✅ Good
expect(response.statusCode).toBe(200);
expect(response.body).toHaveProperty("id");
expect(response.headers["content-type"]).toMatch(/json/);
```

### 4. Async/Await

```javascript
// ❌ Bad
test("should create item", (done) => {
  request(app).post(...).end((err, res) => {
    expect(res.statusCode).toBe(201);
    done();
  });
});

// ✅ Good
test("should create item", async () => {
  const res = await request(app).post(...);
  expect(res.statusCode).toBe(201);
});
```

---

## 📋 Checklist trước khi Deploy

### Security ✅

- [ ] SQL injection tests passing
- [ ] Authentication tests passing
- [ ] Authorization tests passing
- [ ] XSS prevention working
- [ ] CORS configured
- [ ] Rate limiting implemented

### Performance ✅

- [ ] Response time < 200ms
- [ ] Handle 50+ concurrent requests
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Compression enabled

### Data Validation ✅

- [ ] Required fields validated
- [ ] String length constraints
- [ ] Email format validation
- [ ] Date validation
- [ ] Type checking

### Integration ✅

- [ ] CRUD workflow working
- [ ] Pagination working
- [ ] Filtering working
- [ ] Error handling consistent
- [ ] Logging/audit trail working

---

## 🐛 Common Issues & Solutions

### Issue 1: Timeout Errors

```javascript
// Error: Timeout - Async callback was not invoked
// Solution: Increase timeout
jest.setTimeout(10000); // 10 seconds
```

### Issue 2: Mock Not Called

```javascript
// mockDbFunctions.run mock không được gọi
// Solution: Kiểm tra async/await
await request(app).post(...);
expect(mockDbFunctions.run).toHaveBeenCalled();
```

### Issue 3: Test Isolation

```javascript
// beforeEach không reset mocks
// Solution: Thêm jest.clearAllMocks()
beforeEach(() => {
  jest.clearAllMocks();
});
```

---

## 📚 Tài liệu Tham khảo

- [Jest Documentation](https://jestjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [REST API Best Practices](https://restfulapi.net/)

---

## 🤝 Đóng góp

Để thêm test mới:

1. Tạo file test mới: `test/feature.test.js`
2. Follow test structure
3. Thêm comments bằng tiếng Anh và Việt
4. Chạy test để verify: `npm test`
5. Update documentation

---

## 📞 Support

Nếu có issue:

1. Chạy test với `--verbose` flag
2. Kiểm tra logs
3. Xem test file comments
4. Tham khảo documentation

---

**Last Updated**: 2024-11-16
**Author**: API Test Suite
**Version**: 1.0.0
