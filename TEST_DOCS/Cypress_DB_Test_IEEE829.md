# IEEE 829 — Test Case Specification

Project: BuaComXanh
Document: Cypress DB Interaction Tests (ECP + BAV)
Author: Dev/Test Team
Date: (auto-generated)

## 1. Test Item

- API endpoint: `/api/foods` (POST)
- Support endpoints for test setup: `/api/testing/reset` (POST)

## 2. Features to be tested

- Business rule: `qty` must be a positive integer within allowed limits.
- API input validation and response codes.

## 3. Approach

- Use Cypress `cy.request()` to call API directly for speed and determinism.
- Use `cy.resetDatabase()` (which calls `/api/testing/reset`) in `before()` to ensure a clean, seeded DB for each test suite.
- Tests cover Equivalence Class Partitioning (ECP) and Boundary Value Analysis (BAV).

## 4. Pass/Fail criteria

- Pass: API returns expected HTTP status and response body for each case.
- Fail: Response status or body differs from expectation, or any unexpected server error occurs.

## 5. Test Cases

### TC-DB-001 — ECP: valid positive integer

- ID: TC-DB-001
- Purpose: Verify API accepts typical valid qty (e.g., 10).
- Preconditions: DB seeded via `cy.resetDatabase()`; donor user exists.
- Steps:
  1. Programmatically login as donor (API) to obtain token.
  2. POST `/api/foods` with `qty: 10`.
- Expected Result: HTTP 201 Created and response contains created item id.

### TC-DB-002 — ECP: negative quantity

- ID: TC-DB-002
- Purpose: Verify API rejects negative quantities.
- Steps:
  1. Login as donor.
  2. POST `/api/foods` with `qty: -5`.
- Expected Result: HTTP 400 or 422 (validation error).

### TC-DB-003 — ECP: non-integer quantity

- ID: TC-DB-003
- Purpose: Verify API rejects non-integer (float or string) formats.
- Steps: similar to above with `qty: 3.14`.
- Expected Result: HTTP 400 or 422.

### TC-DB-004 — BAV: qty = MIN (1)

- ID: TC-DB-004
- Purpose: Verify API accepts minimum allowed quantity.
- Expected Result: HTTP 201.

### TC-DB-005 — BAV: qty = MIN - 1 (0)

- ID: TC-DB-005
- Purpose: Verify API rejects qty below minimum.
- Expected Result: HTTP 400/422.

### TC-DB-006 — BAV: qty = MAX (1000)

- ID: TC-DB-006
- Purpose: Verify API accepts maximum allowed quantity.
- Expected Result: HTTP 201.

### TC-DB-007 — BAV: qty = MAX + 1 (1001)

- ID: TC-DB-007
- Purpose: Verify API rejects qty above maximum.
- Expected Result: HTTP 400/422.

## 6. Environmental Needs

- Backend running with `NODE_ENV=test` and pointing to test DB (separate from production).
- Cypress configured: `CYPRESS_BASE_URL` and `API_URL` point to test backend.

## 7. Risks and Mitigations

- Risk: Test endpoint accidentally enabled in non-test env. Mitigation: route is mounted only when `NODE_ENV === 'test'` and the router handler checks env.
- Risk: seed script modifies production DB if env misconfigured. Mitigation: ensure `.env.test` uses different DB and start backend with `NODE_ENV=test` and config `dotenv_config_path=.env.test`.

## 8. Notes

- Keep test-only endpoints and seed scripts out of production deployments.
- Document and review any change to seed scripts to avoid accidental data loss.
