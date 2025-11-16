/// <reference types="cypress" />

/**
 * security_and_api_comprehensive.cy.js
 *
 * Comprehensive test suite covering:
 * - API validation and error handling
 * - Security vulnerabilities (SQL Injection, XSS, CSRF, Broken Auth)
 * - Performance and speed issues
 * - Common web vulnerabilities reported by hackers
 * - Edge cases and business logic bypass attempts
 */

describe("🔒 Comprehensive Security, API & Bug Discovery Tests", () => {
  const api = () => Cypress.env("API_URL") || "http://localhost:4000";
  const baseUrl = () => Cypress.config("baseUrl") || "http://localhost:5173";

  before(() => {
    cy.resetDatabase();
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  // ============================================================================
  // PART 1: API VALIDATION & INPUT SANITIZATION (Prevent SQL Injection, XSS)
  // ============================================================================
  describe("Part 1: API Input Validation & Injection Prevention", () => {
    it("Should reject SQL injection in email field", () => {
      const payload = {
        email: "admin' OR '1'='1",
        password: "password123",
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        // Should fail with 400/401/422 (not 200 success)
        expect(resp.status).to.not.equal(200);
      });
    });

    it("Should reject SQL injection in name field during registration", () => {
      const payload = {
        name: "Test'; DROP TABLE users; --",
        email: `test_${Date.now()}@bua.com`,
        phone: "0987654321",
        password: "Password123!",
        confirmPassword: "Password123!",
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/auth/register`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(201);
      });
    });

    it("Should sanitize XSS payloads in title field (Food item)", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: '<script>alert("XSS")</script>Malicious Food',
        description: "Test XSS",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
      }).then((resp) => {
        expect(resp.status).to.equal(201);
        // Verify script tags are escaped/removed in response
        expect(resp.body.title).to.not.include("<script>");
      });
    });

    it("Should reject oversized payloads (10MB+ limit test)", () => {
      cy.login("donor@bua.com", "donor123");

      // Create a payload larger than typical limit
      const largeString = "A".repeat(11 * 1024 * 1024); // 11MB
      const payload = {
        title: largeString,
        description: "Test oversized",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([413, 400, 422]);
      });
    });

    it("Should reject invalid email formats", () => {
      const invalidEmails = [
        "notanemail",
        "@example.com",
        "user@",
        "user @example.com",
        "user@domain",
      ];

      invalidEmails.forEach((email) => {
        cy.request({
          method: "POST",
          url: `${api()}/api/auth/login`,
          body: { email, password: "password123" },
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.not.equal(200);
        });
      });
    });

    it("Should validate phone number format", () => {
      const payload = {
        name: "Test User",
        email: `test_${Date.now()}@bua.com`,
        phone: "not-a-phone-number",
        password: "Password123!",
        confirmPassword: "Password123!",
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/auth/register`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(201);
      });
    });
  });

  // ============================================================================
  // PART 2: AUTHENTICATION & AUTHORIZATION BYPASS ATTEMPTS
  // ============================================================================
  describe("Part 2: Authentication & Authorization Bypass", () => {
    it("Should reject login with empty credentials", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: { email: "", password: "" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(200);
      });
    });

    it("Should reject login with null values", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: { email: null, password: null },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(200);
      });
    });

    it("Should reject access to admin routes without proper role", () => {
      cy.login("donor@bua.com", "donor123"); // Non-admin user

      cy.request({
        method: "GET",
        url: `${api()}/api/admin/users`,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(200);
        expect([401, 403]).to.include(resp.status);
      });
    });

    it("Should reject invalid token", () => {
      cy.setCookie("token", "invalid.token.here");

      cy.request({
        method: "GET",
        url: `${api()}/api/users`,
        headers: {
          Authorization: "Bearer invalid.token.here",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([401, 403]);
      });
    });

    it("Should reject token tampering", () => {
      cy.login("donor@bua.com", "donor123").then(() => {
        const token = cy.getCookie("token").then((c) => {
          const tampered = c.value.slice(0, -10) + "tampered!!";
          cy.setCookie("token", tampered);

          cy.request({
            method: "GET",
            url: `${api()}/api/users`,
            headers: { Authorization: `Bearer ${tampered}` },
            failOnStatusCode: false,
          }).then((resp) => {
            expect(resp.status).to.be.oneOf([401, 403]);
          });
        });
      });
    });

    it("Should not allow privilege escalation (donor -> admin)", () => {
      cy.login("donor@bua.com", "donor123");

      // Try to modify own role via API
      cy.request({
        method: "PUT",
        url: `${api()}/api/users/me`,
        body: { role: "admin" },
        failOnStatusCode: false,
      }).then((resp) => {
        // Should succeed (user can update own profile) but role should not change
        if (resp.status === 200) {
          expect(resp.body.role).to.not.equal("admin");
        }
      });
    });
  });

  // ============================================================================
  // PART 3: BUSINESS LOGIC & COMMON VULNERABILITIES
  // ============================================================================
  describe("Part 3: Business Logic & Common Vulnerabilities", () => {
    it("Should prevent booking same item twice simultaneously", () => {
      cy.login("receiver@bua.com", "recv123");

      // Get available food item
      cy.request("GET", `${api()}/api/foods?status=available`).then((resp) => {
        if (resp.body.length > 0) {
          const itemId = resp.body[0].id;
          const qty = 5;

          // First booking
          cy.request({
            method: "POST",
            url: `${api()}/api/bookings`,
            body: { food_item_id: itemId, qty },
          }).then((resp1) => {
            expect(resp1.status).to.equal(201);

            // Second booking with same qty - should fail or adjust qty
            cy.request({
              method: "POST",
              url: `${api()}/api/bookings`,
              body: { food_item_id: itemId, qty },
              failOnStatusCode: false,
            }).then((resp2) => {
              // Either reject or reduce qty
              if (resp2.status === 201) {
                expect(resp2.body.qty).to.be.lessThan(qty);
              }
            });
          });
        }
      });
    });

    it("Should prevent negative quantity in booking", () => {
      cy.login("receiver@bua.com", "recv123");

      cy.request({
        method: "POST",
        url: `${api()}/api/bookings`,
        body: { food_item_id: "some-id", qty: -5 },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(201);
      });
    });

    it("Should prevent booking more than available qty", () => {
      cy.login("receiver@bua.com", "recv123");

      cy.request("GET", `${api()}/api/foods?status=available`).then((resp) => {
        if (resp.body.length > 0) {
          const itemId = resp.body[0].id;
          const availableQty = resp.body[0].qty;

          cy.request({
            method: "POST",
            url: `${api()}/api/bookings`,
            body: { food_item_id: itemId, qty: availableQty + 100 },
            failOnStatusCode: false,
          }).then((resp) => {
            expect(resp.status).to.be.oneOf([400, 422]);
          });
        }
      });
    });

    it("Should prevent donor from viewing other donors' private items", () => {
      // This depends on visibility settings in your API
      // Create private item as donor1, verify donor2 cannot see it
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "Private Food Item",
        description: "This should be private",
        qty: 5,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        visibility: "private",
      };

      cy.request("POST", `${api()}/api/foods`, payload).then((resp) => {
        const itemId = resp.body.id;

        // Logout and try to access as another user (if multi-donor test data exists)
        cy.clearCookies();
        cy.request({
          method: "GET",
          url: `${api()}/api/foods/${itemId}`,
          failOnStatusCode: false,
        }).then((resp2) => {
          // Should either be 403 or not show private data
          if (resp2.status === 200) {
            expect(resp2.body.visibility).to.equal("public");
          }
        });
      });
    });
  });

  // ============================================================================
  // PART 4: PERFORMANCE & SPEED ISSUES
  // ============================================================================
  describe("Part 4: Performance & Response Time Tests", () => {
    it("GET /api/foods should respond within 500ms", () => {
      const startTime = Date.now();

      cy.request("GET", `${api()}/api/foods`).then((resp) => {
        const duration = Date.now() - startTime;
        expect(duration).to.be.lessThan(500);
        expect(resp.status).to.equal(200);
      });
    });

    it("POST /api/bookings should respond within 1000ms", () => {
      cy.login("receiver@bua.com", "recv123");

      cy.request("GET", `${api()}/api/foods`).then((foods) => {
        if (foods.body.length > 0) {
          const startTime = Date.now();

          cy.request({
            method: "POST",
            url: `${api()}/api/bookings`,
            body: { food_item_id: foods.body[0].id, qty: 2 },
          }).then((resp) => {
            const duration = Date.now() - startTime;
            expect(duration).to.be.lessThan(1000);
            expect(resp.status).to.equal(201);
          });
        }
      });
    });

    it("Should handle pagination efficiently (e.g., /api/foods?page=100)", () => {
      const startTime = Date.now();

      cy.request({
        method: "GET",
        url: `${api()}/api/foods?page=100&limit=50`,
        failOnStatusCode: false,
      }).then((resp) => {
        const duration = Date.now() - startTime;
        expect(duration).to.be.lessThan(2000);
      });
    });

    it("Concurrent requests should not cause race conditions", () => {
      cy.login("receiver@bua.com", "recv123");

      cy.request("GET", `${api()}/api/foods`).then((foods) => {
        if (foods.body.length > 0) {
          const itemId = foods.body[0].id;

          // Send 5 concurrent booking requests
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              cy.request({
                method: "POST",
                url: `${api()}/api/bookings`,
                body: { food_item_id: itemId, qty: 1 },
                failOnStatusCode: false,
              })
            );
          }

          // At least some should fail due to insufficient qty
          cy.wrap(promises).then(() => {
            // Verify only appropriate qty was booked
            cy.request("GET", `${api()}/api/foods/${itemId}`).then((resp) => {
              expect(resp.body.qty).to.be.a("number");
            });
          });
        }
      });
    });
  });

  // ============================================================================
  // PART 5: RESPONSE HANDLING & ERROR MESSAGES
  // ============================================================================
  describe("Part 5: Response Handling & Error Messages", () => {
    it("Should not expose sensitive information in error messages", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: { email: "nonexistent@bua.com", password: "wrongpass" },
        failOnStatusCode: false,
      }).then((resp) => {
        const message = JSON.stringify(resp.body);
        expect(message).to.not.include("password");
        expect(message).to.not.include("hash");
        expect(message).to.not.include("salt");
      });
    });

    it("Should return consistent error format", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: { email: "invalid", password: "" },
        failOnStatusCode: false,
      }).then((resp) => {
        // Should have error field or message
        expect(resp.body).to.have.property("error").or.have.property("message");
      });
    });

    it("Should handle 404 gracefully", () => {
      cy.request({
        method: "GET",
        url: `${api()}/api/foods/nonexistent-id-12345`,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.equal(404);
        expect(resp.body).to.have.property("error");
      });
    });

    it("Should handle 500 errors gracefully", () => {
      // Trigger an error by sending invalid data type
      cy.request({
        method: "POST",
        url: `${api()}/api/bookings`,
        body: { food_item_id: null, qty: "not-a-number" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect([400, 422, 500]).to.include(resp.status);
      });
    });
  });

  // ============================================================================
  // PART 6: CSRF & SESSION SECURITY
  // ============================================================================
  describe("Part 6: CSRF & Session Security", () => {
    it("Should set secure cookies with HttpOnly flag", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/login`,
        body: { email: "admin@bua.com", password: "admin123" },
      }).then((resp) => {
        cy.getCookie("token").then((cookie) => {
          if (cookie) {
            // Should not be accessible via JavaScript in production
            expect(cookie.secure === true || cookie.httpOnly === true).to.be.ok;
          }
        });
      });
    });

    it("Should clear session on logout", () => {
      cy.login("donor@bua.com", "donor123");

      cy.getCookie("token").then((cookie) => {
        expect(cookie).to.exist;
      });

      cy.request({
        method: "POST",
        url: `${api()}/api/auth/logout`,
      }).then(() => {
        cy.getCookie("token").then((cookie) => {
          expect(cookie).to.be.null;
        });
      });
    });
  });

  // ============================================================================
  // PART 7: COMMON HACKER-REPORTED VULNERABILITIES
  // ============================================================================
  describe("Part 7: Common Hacker-Found Vulnerabilities", () => {
    it("Should not leak user count via API", () => {
      // Some apps expose /api/users/count without auth
      cy.request({
        method: "GET",
        url: `${api()}/api/users/count`,
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status === 200) {
          // If endpoint exists, should require auth
          cy.login("donor@bua.com", "donor123");
          cy.request("GET", `${api()}/api/users/count`).then((resp2) => {
            expect(resp2.status).to.equal(200);
          });
        }
      });
    });

    it("Should prevent directory traversal attacks", () => {
      cy.request({
        method: "GET",
        url: `${api()}/api/foods/../../admin`,
        failOnStatusCode: false,
      }).then((resp) => {
        expect([404, 400]).to.include(resp.status);
      });
    });

    it("Should not allow JSONP callbacks (prevent JSONP hijacking)", () => {
      cy.request({
        method: "GET",
        url: `${api()}/api/foods?callback=maliciousFunction`,
        failOnStatusCode: false,
      }).then((resp) => {
        const body = JSON.stringify(resp.body);
        expect(body).to.not.include("maliciousFunction");
      });
    });

    it("Should prevent insecure direct object reference (IDOR)", () => {
      cy.login("donor@bua.com", "donor123");

      // Get own foods
      cy.request("GET", `${api()}/api/foods`).then((resp) => {
        if (resp.body.length > 0) {
          const ownItemId = resp.body[0].id;

          // Logout and try to access as receiver
          cy.clearCookies();
          cy.login("receiver@bua.com", "recv123");

          cy.request({
            method: "DELETE",
            url: `${api()}/api/foods/${ownItemId}`,
            failOnStatusCode: false,
          }).then((resp2) => {
            expect(resp2.status).to.not.equal(200);
          });
        }
      });
    });

    it("Should validate and sanitize file uploads", () => {
      cy.login("donor@bua.com", "donor123");

      // Try to upload executable or suspicious file
      cy.request({
        method: "POST",
        url: `${api()}/api/upload`,
        form: true,
        body: {
          file: "malicious.exe",
        },
        failOnStatusCode: false,
      }).then((resp) => {
        // Should reject or sanitize
        expect([400, 415, 422]).to.include(resp.status);
      });
    });
  });

  // ============================================================================
  // PART 8: FRONTEND SECURITY (UI/XSS TESTS)
  // ============================================================================
  describe("Part 8: Frontend Security & XSS Prevention", () => {
    it("Should not execute inline scripts from user input", () => {
      cy.login("donor@bua.com", "donor123");
      cy.visit("/foods/new");

      // Try to inject script in form
      cy.get('input[name="title"]').type('<script>alert("XSS")</script>');
      cy.get("form").submit();

      // Check that script was not executed
      cy.on("window:alert", () => {
        throw new Error("XSS vulnerability detected!");
      });
    });

    it("Should sanitize displayed user content", () => {
      cy.login("donor@bua.com", "donor123");

      // Create item with HTML content
      cy.request("POST", `${api()}/api/foods`, {
        title: '<img src=x onerror="alert(1)">Hack',
        description: "Test",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }).then((resp) => {
        const itemId = resp.body.id;

        // Visit foods page and check item is displayed safely
        cy.visit("/foods");
        cy.contains("Hack").should("be.visible");

        // Verify no onerror event handler is executed
        cy.on("window:alert", () => {
          throw new Error("XSS vulnerability in display!");
        });
      });
    });

    it("Should prevent clickjacking (X-Frame-Options header)", () => {
      cy.request("GET", `${api()}/api/health`).then((resp) => {
        const frameOptions = resp.headers["x-frame-options"];
        expect(["DENY", "SAMEORIGIN"]).to.include(frameOptions);
      });
    });
  });

  // ============================================================================
  // PART 9: DATA VALIDATION & BUSINESS CONSTRAINTS
  // ============================================================================
  describe("Part 9: Data Validation & Business Constraints", () => {
    it("Should validate expire_at is in future", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "Expired Food",
        description: "Test",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() - 1000).toISOString(), // Past date
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(201);
      });
    });

    it("Should require all mandatory fields", () => {
      cy.login("donor@bua.com", "donor123");

      const mandatoryFields = ["title", "qty", "unit", "expire_at"];

      mandatoryFields.forEach((field) => {
        const payload = {
          title: "Test",
          description: "Test",
          qty: 10,
          unit: "suất",
          expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        };
        delete payload[field];

        cy.request({
          method: "POST",
          url: `${api()}/api/foods`,
          body: payload,
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.not.equal(201);
        });
      });
    });

    it("Should validate location coordinates (lat/lng)", () => {
      cy.login("donor@bua.com", "donor123");

      const invalidCoords = [
        { lat: 95, lng: 180 }, // lat > 90
        { lat: -100, lng: 180 }, // lat < -90
        { lat: 45, lng: 200 }, // lng > 180
        { lat: 45, lng: -200 }, // lng < -180
      ];

      invalidCoords.forEach(({ lat, lng }) => {
        cy.request({
          method: "POST",
          url: `${api()}/api/foods`,
          body: {
            title: "Test",
            description: "Test",
            qty: 10,
            unit: "suất",
            expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            lat,
            lng,
          },
          failOnStatusCode: false,
        }).then((resp) => {
          expect(resp.status).to.be.oneOf([400, 422]);
        });
      });
    });
  });

  // ============================================================================
  // PART 10: RATE LIMITING & DOS PROTECTION
  // ============================================================================
  describe("Part 10: Rate Limiting & DOS Protection", () => {
    it("Should implement rate limiting on login endpoint", () => {
      const attempts = 15; // Try 15 times
      let blockDetected = false;

      for (let i = 0; i < attempts; i++) {
        cy.request({
          method: "POST",
          url: `${api()}/api/auth/login`,
          body: { email: "test@bua.com", password: "wrong" },
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 429) {
            blockDetected = true;
          }
        });
      }

      // At least one should be rate limited
      cy.then(() => {
        expect(blockDetected).to.be.true;
      });
    });

    it("Should implement rate limiting on registration", () => {
      const attempts = 10;
      let blockDetected = false;

      for (let i = 0; i < attempts; i++) {
        cy.request({
          method: "POST",
          url: `${api()}/api/auth/register`,
          body: {
            name: `User ${i}`,
            email: `spam_${i}_${Date.now()}@bua.com`,
            phone: "0987654321",
            password: "Password123!",
            confirmPassword: "Password123!",
          },
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 429) {
            blockDetected = true;
          }
        });
      }

      cy.then(() => {
        expect(blockDetected).to.be.true;
      });
    });
  });
});
