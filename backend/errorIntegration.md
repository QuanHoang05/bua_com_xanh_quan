# Integration Test Error Report

**Generated**: 11/17/2025, 10:59:15 AM
**Total Errors**: 10

## Error 1: AUTH

```

📥 Importing app with real database...
[DB] using MySQL root@127.0.0.1:3306/bua_com_xanh SSL=false
[DB] MySQL connected OK
✅ [INFO] Testing routes are enabled for E2E tests.
✅ App imported - Connected to real MySQL database

✅ AUTH-INT-01: Register User - PASS
   └─ Status: 201
✅ AUTH-INT-02: Login - PASS
   └─ Status: 200
✅ AUTH-INT-03: Get Profile - PASS
   └─ Email: auth.test.1763351947681@example.com
❌ AUTH-INT-04: Change Password - FAIL
   └─ Status: 400
✅ AUTH-INT-05: Login with New Passw
```

## Error 2: AUTH

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/ for more information.
    at Object.trustProxy (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist/index.mjs:139:13)
    at wrappedValidations.<computed> [as trustProxy] (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist
```

## Error 3: METRICS

```

📥 Importing app with real database...
[DB] using MySQL root@127.0.0.1:3306/bua_com_xanh SSL=false
[DB] MySQL connected OK
✅ [INFO] Testing routes are enabled for E2E tests.
✅ App imported - Connected to real MySQL database

❌ ADMN-MTR-01: Delivery Success Stats - SKIP
   └─ Requires admin auth
❌ ADMN-MTR-02: Heatmap Data - SKIP
   └─ Requires admin auth
❌ ADMN-MTR-03: Donor Statistics - FAIL
   └─ Status: 404
❌ ADMN-MTR-04: Campaign Statistics - FAIL
   └─ Status: 404
❌ ADMN-MTR-05: Overview M
```

## Error 4: METRICS

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/ for more information.
    at Object.trustProxy (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist/index.mjs:139:13)
    at wrappedValidations.<computed> [as trustProxy] (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist
```

## Error 5: CAMPAIGNS

```

📥 Importing app with real database...
[DB] using MySQL root@127.0.0.1:3306/bua_com_xanh SSL=false
[DB] MySQL connected OK
✅ [INFO] Testing routes are enabled for E2E tests.
✅ App imported - Connected to real MySQL database

❌ CAMP-INT-01: List All Campaigns - FAIL
   └─ Status: 500
❌ CAMP-INT-02: Get Campaign Details - SKIP
   └─ No campaigns found
❌ CAMP-INT-03: Filter by Status - FAIL
   └─ Status: 500
❌ CAMP-INT-04: Search Campaigns - FAIL
   └─ Status: 500
❌ CAMP-INT-05: Sort Campaigns - F
```

## Error 6: CAMPAIGNS

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/ for more information.
    at Object.trustProxy (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist/index.mjs:139:13)
    at wrappedValidations.<computed> [as trustProxy] (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist
```

## Error 7: USERS

```

📥 Importing app with real database...
[DB] using MySQL root@127.0.0.1:3306/bua_com_xanh SSL=false
[DB] MySQL connected OK
✅ [INFO] Testing routes are enabled for E2E tests.
✅ App imported - Connected to real MySQL database

❌ USER-INT-01: Get User Profile - FAIL
   └─ No user token
❌ USER-INT-02: Update User Profile - FAIL
   └─ No user token
❌ USER-INT-03: Get Delivery History - FAIL
   └─ No user token
❌ USER-INT-04: Get Donations History - FAIL
   └─ No user token
❌ USER-INT-05: Get User Ac
```

## Error 8: USERS

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/ for more information.
    at Object.trustProxy (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist/index.mjs:139:13)
    at wrappedValidations.<computed> [as trustProxy] (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist
```

## Error 9: ADMIN

```

📥 Importing app with real database...
[DB] using MySQL root@127.0.0.1:3306/bua_com_xanh SSL=false
[DB] MySQL connected OK
✅ [INFO] Testing routes are enabled for E2E tests.
✅ App imported - Connected to real MySQL database

❌ ADMIN-USR-01: List All Users - FAIL
   └─ No admin token
❌ ADMIN-USR-02: Get User Details - FAIL
   └─ No admin token
❌ ADMIN-USR-03: Update User - FAIL
   └─ No admin token
❌ ADMIN-USR-04: Make User Admin - FAIL
   └─ No admin token
❌ ADMIN-USR-05: Ban User - FAIL
   └─ 
```

## Error 10: ADMIN

```
ValidationError: The Express 'trust proxy' setting is true, which allows anyone to trivially bypass IP-based rate limiting. See https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY/ for more information.
    at Object.trustProxy (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist/index.mjs:139:13)
    at wrappedValidations.<computed> [as trustProxy] (file:///D:/projectManage/BuaComXanh/BuaComXanh/backend/node_modules/express-rate-limit/dist
```

---

**Note**: For full logs, check `test-logs/npm-test.log`
