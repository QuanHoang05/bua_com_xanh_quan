# Quick Fix Reference

## 6 Main Issues Fixed:

### 1. ✅ bcryptjs → bcrypt

- **Files:** `test/auth.test.js`, `test/users.test.js`
- **Change:** `jest.unstable_mockModule("bcryptjs", ...)` → `jest.unstable_mockModule("bcrypt", ...)`
- **Reason:** package.json has `bcrypt` not `bcryptjs`

### 2. ✅ admin.announcements - hasColumn undefined

- **File:** `test/admin.announcements.test.js`
- **Change:** Add mock for `ensure-mysql` and ensure `query` returns `[[], null]` tuple
- **Reason:** hasColumn() calls catch chain that returns undefined

### 3. ✅ recipients - 401 + Timeout

- **File:** `test/recipients.test.js`
- **Change:** Properly mock requireAuth with JWT.verify()
- **Reason:** Middleware needs to verify token and attach user to req

### 4. ✅ donors - 401 Error

- **File:** `test/donors.test.js`
- **Change:** Mock user object with all fields: name, email, avatar_url, address, status, phone
- **Reason:** Auth query needs all these fields, not just some

### 5. ✅ shippers - 404 Error

- **File:** `test/shippers.test.js`
- **Change:** Use actual endpoints GET /deliveries and PATCH /deliveries/:id
- **Reason:** Routes file doesn't have /orders/mine endpoint

### 6. ✅ Duplicate test files

- **File:** `jest.config.js`
- **Change:** Add `testMatch: ['<rootDir>/test/**/*.test.js']`
- **Reason:** Prevents running tests from root directory duplicates

---

## Before/After Example

### Before (bcryptjs mock):

```javascript
jest.unstable_mockModule("bcryptjs", () => ({...}));
const bcryptModule = await import("bcryptjs");  // ❌ Not found
```

### After (bcrypt mock):

```javascript
jest.unstable_mockModule("bcrypt", () => ({...}));
const bcryptModule = await import("bcrypt");  // ✅ Correct package
```

---

## Testing Commands

```bash
cd backend
npm test                    # Run all tests
npm test -- --testNamePattern="auth"   # Run only auth tests
npm test -- --testNamePattern="donors" # Run only donors tests
```

---

## Files to Delete Manually

From VS Code Explorer or terminal:

```bash
rm backend/auth.test.js          # Duplicate
rm backend/auth.real.test.js     # Duplicate
rm backend/auth.test.js.bak      # Backup file
```


