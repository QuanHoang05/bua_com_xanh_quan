| Test Case ID | Endpoint / Function                    | Pre-condition                              | Input / Action                                                 | Expected Result                                           | Status  | Actual / Expected Result |
| -----------: | -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------- | ------- | ------------------------ |
|       ECP-01 | POST /api/testing/reset                | `NODE_ENV=test` and DB reachable           | POST /api/testing/reset                                        | 200 OK, message 'Database reset and seeded successfully.' | Not Run | -                        |
|       ECP-02 | POST /api/auth/register                | Database is seeded/clean                   | POST /api/auth/register with valid name/email/password/address | 201 Created, response contains `user` and `token`         | Not Run | -                        |
|       ECP-03 | POST /api/auth/login                   | User exists (from ECP-02 or seed)          | POST /api/auth/login with valid email/password                 | 200 OK, response contains `user` and `token`              | Not Run | -                        |
|       ECP-04 | GET /api/auth/me                       | Valid Bearer token in Authorization header | GET /api/auth/me with `Authorization: Bearer <token>`          | 200 OK, response contains `user` with expected email      | Not Run | -                        |
|       BVA-01 | POST /api/auth/register (missing name) | DB seeded                                  | POST /api/auth/register with missing `name`                    | 400 Bad Request                                           | Not Run | -                        |
|       BVA-02 | POST /api/auth/login (wrong password)  | User exists                                | POST /api/auth/login with valid email but wrong password       | 401 Unauthorized                                          | Not Run | -                        |
|       ECP-05 | Logging token retrieval                | N/A                                        | Log returned token values for register/login                   | Token string present in response and printed to log       | Not Run | -                        |

Notes:

- Use environment variables to configure DB connection: `DB_DRIVER=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE=bua_com_xanh`.
- Tests will attempt to call the special testing route `/api/testing/reset` which runs `npm run test:db:reset` defined in project scripts; ensure XAMPP MySQL is running and accessible.
- Update test statuses and Actual/Expected Result with observed output after running the suite.
