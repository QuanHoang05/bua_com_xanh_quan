# Mock Issues - Quick Reference

## Common Mock Problems & Solutions

| Issue                          | Symptom                                              | Fix                                                          |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------ |
| **bcryptjs import fails**      | `Cannot find module 'bcryptjs'`                      | Wrap import in try-catch, provide fallback mock              |
| **MySQL query format wrong**   | `TypeError: Cannot read properties of undefined`     | Mock `db.query()` returning `[[rows], null]` not just `rows` |
| **Auth middleware not mocked** | `401 Unauthorized`                                   | Mock middleware with `jest.unstable_mockModule()`            |
| **Route not registered**       | `404 Not Found`                                      | Import routes in `beforeAll` AFTER `jest.resetModules()`     |
| **Empty promise chain**        | `Cannot read properties of undefined (reading '...)` | Initialize all mock return values in `beforeEach`            |
| **Wrong relative paths**       | `Cannot find module '../src/...'`                    | Ensure test file is in correct location (`test/` folder)     |

---

## Critical Code Patterns

### ✅ CORRECT: Mocking MySQL Database

```javascript
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    query: jest.fn().mockResolvedValue([[mockData], null]), // [rows, metadata]
  },
}));
```

### ❌ WRONG: Incomplete Mock

```javascript
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({
  db: {
    get: jest.fn().mockResolvedValue(mockData), // Missing query()
  },
}));
```

---

### ✅ CORRECT: Route Import in Tests

```javascript
beforeAll(async () => {
  process.env.DB_DRIVER = "mysql";
  jest.resetModules(); // MUST reset FIRST

  const dbModule = await import("../src/lib/db.mysql.js");
  const { default: router } = await import("../src/routes/xyz.js");
  // NOW use the router
});
```

### ❌ WRONG: Module-Level Import

```javascript
// DON'T DO THIS - imports before mocks are applied!
const { default: router } = await import("../src/routes/xyz.js");

describe("...", () => {
  // Too late - router already loaded without mocks
});
```

---

### ✅ CORRECT: Middleware Mocking

```javascript
jest.unstable_mockModule("../src/middlewares/auth.js", () => ({
  requireAuth: () => (req, res, next) => next(), // Pass through
}));
```

### ❌ WRONG: Not Mocking Middleware

```javascript
// Middleware tries to access DB, causes errors
jest.unstable_mockModule("../src/lib/db.mysql.js", () => ({ ... }));
// But auth.js isn't mocked, still tries real DB calls
```

---

## Mock Initialization Checklist

For each test file, ensure:

- [ ] All DB modules mocked with `jest.unstable_mockModule()`
- [ ] Auth/role middlewares mocked (unless testing them)
- [ ] External modules (fetch, email, etc.) mocked
- [ ] `jest.resetModules()` called in `beforeAll`
- [ ] Routes imported AFTER `resetModules()`
- [ ] All mock return values match driver format:
  - SQLite: direct objects/arrays from `prepare().get/all()`
  - MySQL: `[rows, metadata]` tuples from `query()`
- [ ] `beforeEach` clears and resets all mocks
- [ ] JWT tokens created with `process.env.JWT_SECRET`
- [ ] Test middleware bypassed by mocking OR properly set up with mocks

---

## Test Execution Order

```
1. Jest loads test file
2. Mock registrations applied (jest.unstable_mockModule)
3. Test describe() block executes
4. beforeAll() runs:
   - Set env vars
   - jest.resetModules() - clears require cache
   - Import mocked modules
   - Create Express app
   - Mount routes
5. beforeEach() runs:
   - jest.clearAllMocks()
   - Reset mock return values
6. test() runs - actual test
7. afterAll() cleanup
```

---

## Common Env Variables to Set

```javascript
beforeAll(() => {
  process.env.DB_DRIVER = "mysql"; // or "sqlite"
  process.env.JWT_SECRET = "test_secret";
  process.env.NODE_ENV = "test";

  // API-specific
  process.env.MOMO_ACCESS_KEY = "test_key";
  process.env.PAYMENTS_FORCE_MOCK = "1";

  // Always call after env setup
  jest.resetModules();
});
```

---

## Files Modified in This Fix

```
backend/test/
├── auth.test.js                    ✅ Fixed bcryptjs import
├── campaigns.test.js               ✅ Fixed MySQL mock format
├── donors.test.js                  ✅ Fixed auth & DB mocking
├── recipients.test.js              ✅ Added middleware mock
├── shippers.test.js                ✅ Fixed route registration
├── admin.announcements.test.js      ✅ Fixed mock initialization
├── auth.ci.test.js                 ✅ Added placeholder test
├── auth.real.test.js               ✅ Moved file, fixed imports
└── payments.momo.test.js           ✅ Fixed auth & query format
```

---

## Verification Command

```bash
cd backend
npm test

# Should see: Tests: XX passed, XX total
# No "Cannot find module" errors
# No "401 Unauthorized" in wrong places
# No "TypeError: Cannot read properties of undefined"
```
