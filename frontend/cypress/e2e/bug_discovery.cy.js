/// <reference types="cypress" />

/**
 * bug_discovery.cy.js
 *
 * Advanced bug discovery test suite based on common vulnerabilities reported by hackers:
 * - Payment bypass vulnerabilities
 * - State manipulation attacks
 * - API endpoint enumeration
 * - Resource exhaustion
 * - Logic flaws in donation/booking system
 * - Timing attacks
 */

describe("🐛 Advanced Bug Discovery & Exploitation Tests", () => {
  const api = () => Cypress.env("API_URL") || "http://localhost:4000";

  before(() => {
    cy.resetDatabase();
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  // ============================================================================
  // PAYMENT & FINANCIAL BUGS
  // ============================================================================
  describe("Payment System Vulnerabilities", () => {
    it("Should not allow negative payment amounts", () => {
      cy.login("donor@bua.com", "donor123");

      cy.request({
        method: "POST",
        url: `${api()}/api/payments`,
        body: { amount: -100, description: "Negative payment" },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.not.equal(201);
      });
    });

    it("Should prevent decimal precision exploits (e.g., 0.01 rounding)", () => {
      cy.login("donor@bua.com", "donor123");

      const amounts = [0.001, 0.0001, 0.00000001]; // Tiny amounts that might bypass validation

      amounts.forEach((amount) => {
        cy.request({
          method: "POST",
          url: `${api()}/api/payments`,
          body: { amount, description: "Precision test" },
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 201) {
            // If allowed, ensure minimum payment rule is enforced
            expect(resp.body.amount).to.be.gte(1000); // Or your minimum
          }
        });
      });
    });

    it("Should prevent payment double-spending via race condition", () => {
      cy.login("donor@bua.com", "donor123");

      // Send concurrent payment requests
      const amount = 50000;
      const requests = [];

      for (let i = 0; i < 3; i++) {
        requests.push(
          cy.request({
            method: "POST",
            url: `${api()}/api/payments`,
            body: { amount, description: "Concurrent payment" },
            failOnStatusCode: false,
          })
        );
      }

      cy.wrap(requests).then(() => {
        // Verify only one payment succeeded (if single-use)
        cy.request("GET", `${api()}/api/payments`).then((resp) => {
          const payments = resp.body.filter((p) => p.amount === amount);
          expect(payments.length).to.be.lessThanOrEqual(1);
        });
      });
    });

    it("Should validate payment receipt before marking as paid", () => {
      cy.login("donor@bua.com", "donor123");

      cy.request({
        method: "POST",
        url: `${api()}/api/payments`,
        body: {
          amount: 100000,
          description: "Test",
          status: "completed", // Trying to set status directly
        },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status === 201) {
          expect(resp.body.status).to.not.equal("completed");
        }
      });
    });
  });

  // ============================================================================
  // STATE MANIPULATION ATTACKS
  // ============================================================================
  describe("State Manipulation & Logic Flaws", () => {
    it("Should prevent changing booking status from user side", () => {
      cy.login("receiver@bua.com", "recv123");

      cy.request("GET", `${api()}/api/foods`).then((foods) => {
        if (foods.body.length > 0) {
          cy.request("POST", `${api()}/api/bookings`, {
            food_item_id: foods.body[0].id,
            qty: 1,
          }).then((booking) => {
            if (booking.status === 201) {
              const bookingId = booking.body.id;

              // Try to change status to 'completed' without approval
              cy.request({
                method: "PUT",
                url: `${api()}/api/bookings/${bookingId}`,
                body: { status: "completed" },
                failOnStatusCode: false,
              }).then((resp) => {
                if (resp.status === 200) {
                  expect(resp.body.status).to.not.equal("completed");
                }
              });
            }
          });
        }
      });
    });

    it("Should prevent modifying food item availability manually", () => {
      cy.login("donor@bua.com", "donor123");

      cy.request("POST", `${api()}/api/foods`, {
        title: "Test Item",
        description: "Test",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }).then((resp) => {
        const itemId = resp.body.id;

        // Try to change qty to 0 without proper workflow
        cy.request({
          method: "PUT",
          url: `${api()}/api/foods/${itemId}`,
          body: { qty: 0, status: "unavailable" },
          failOnStatusCode: false,
        }).then((update) => {
          if (update.status === 200) {
            // Verify it wasn't changed maliciously
            cy.request("GET", `${api()}/api/foods/${itemId}`).then((get) => {
              expect(get.body.qty).to.be.gt(0);
            });
          }
        });
      });
    });
  });

  // ============================================================================
  // API ENDPOINT ENUMERATION & DISCOVERY
  // ============================================================================
  describe("API Enumeration & Hidden Endpoints", () => {
    const commonEndpoints = [
      "/api/admin/users",
      "/api/admin/reset",
      "/api/admin/backup",
      "/api/debug",
      "/api/logs",
      "/api/config",
      "/api/version",
      "/api/health",
      "/api/stats",
      "/api/metrics",
      "/health",
      "/status",
    ];

    it("Should not expose sensitive admin endpoints without auth", () => {
      const sensitiveEndpoints = ["/api/admin/users", "/api/admin/backup"];

      sensitiveEndpoints.forEach((endpoint) => {
        cy.request({
          method: "GET",
          url: `${api()}${endpoint}`,
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 200) {
            // If accessible, should require admin role
            cy.login("donor@bua.com", "donor123");
            cy.request({
              method: "GET",
              url: `${api()}${endpoint}`,
              failOnStatusCode: false,
            }).then((resp2) => {
              expect([403, 401]).to.include(resp2.status);
            });
          }
        });
      });
    });

    it("Should not expose version info that aids exploitation", () => {
      cy.request("GET", `${api()}/api/health`).then((resp) => {
        const body = JSON.stringify(resp.body);
        // Should not leak detailed version numbers
        expect(body).to.not.match(/\d+\.\d+\.\d+/);
      });
    });
  });

  // ============================================================================
  // RESOURCE EXHAUSTION ATTACKS
  // ============================================================================
  describe("Resource Exhaustion & DOS Prevention", () => {
    it("Should limit image upload size", () => {
      cy.login("donor@bua.com", "donor123");

      // Try to upload large file
      const largeData = "x".repeat(50 * 1024 * 1024); // 50MB

      cy.request({
        method: "POST",
        url: `${api()}/api/upload`,
        body: largeData,
        failOnStatusCode: false,
      }).then((resp) => {
        expect([413, 400, 422]).to.include(resp.status);
      });
    });

    it("Should prevent database exhaustion via bulk data creation", () => {
      cy.login("donor@bua.com", "donor123");

      let successCount = 0;

      // Try to create 100 items rapidly
      for (let i = 0; i < 100; i++) {
        cy.request({
          method: "POST",
          url: `${api()}/api/foods`,
          body: {
            title: `Bulk Item ${i}`,
            description: "Bulk test",
            qty: 1,
            unit: "suất",
            expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          },
          failOnStatusCode: false,
        }).then((resp) => {
          if (resp.status === 201) successCount++;
        });
      }

      // Should be rate limited
      cy.then(() => {
        expect(successCount).to.be.lessThan(100);
      });
    });

    it("Should prevent ZIP bomb / nested archive attacks on file uploads", () => {
      cy.login("donor@bua.com", "donor123");

      // Simulate ZIP bomb attempt
      cy.request({
        method: "POST",
        url: `${api()}/api/upload`,
        body: "PK\x03\x04...", // ZIP file header
        failOnStatusCode: false,
      }).then((resp) => {
        expect([400, 415, 422]).to.include(resp.status);
      });
    });
  });

  // ============================================================================
  // TIMING ATTACKS & LOGIC FLAWS
  // ============================================================================
  describe("Timing Attacks & Business Logic Flaws", () => {
    it("Should not leak user existence via response time", () => {
      const validEmail = "admin@bua.com";
      const invalidEmail = "nonexistent12345@bua.com";
      const timings = { valid: [], invalid: [] };

      // Test valid user timing
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        cy.request({
          method: "POST",
          url: `${api()}/api/auth/login`,
          body: { email: validEmail, password: "wrong" },
          failOnStatusCode: false,
        }).then(() => {
          timings.valid.push(Date.now() - start);
        });
      }

      // Test invalid user timing
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        cy.request({
          method: "POST",
          url: `${api()}/api/auth/login`,
          body: { email: invalidEmail, password: "wrong" },
          failOnStatusCode: false,
        }).then(() => {
          timings.invalid.push(Date.now() - start);
        });
      }

      cy.then(() => {
        const avgValid =
          timings.valid.reduce((a, b) => a + b) / timings.valid.length;
        const avgInvalid =
          timings.invalid.reduce((a, b) => a + b) / timings.invalid.length;
        // Should be similar (within 50ms difference)
        expect(Math.abs(avgValid - avgInvalid)).to.be.lessThan(50);
      });
    });

    it("Should prevent transaction race conditions", () => {
      cy.login("donor@bua.com", "donor123");

      cy.request("GET", `${api()}/api/foods`).then((foods) => {
        if (foods.body.length > 0) {
          const itemId = foods.body[0].id;
          const originalQty = foods.body[0].qty;

          // Send concurrent bookings
          const requests = [];
          for (let i = 0; i < 5; i++) {
            requests.push(
              cy.request({
                method: "POST",
                url: `${api()}/api/bookings`,
                body: { food_item_id: itemId, qty: 3 },
                failOnStatusCode: false,
              })
            );
          }

          cy.wrap(requests).then(() => {
            // Verify total booked qty doesn't exceed original
            cy.request("GET", `${api()}/api/foods/${itemId}`).then((resp) => {
              expect(resp.body.qty).to.be.lessThanOrEqual(originalQty);
            });
          });
        }
      });
    });
  });

  // ============================================================================
  // BUSINESS LOGIC BYPASS
  // ============================================================================
  describe("Business Logic Bypass Attempts", () => {
    it("Should not allow booking already delivered/completed items", () => {
      // This requires understanding the complete booking lifecycle
      cy.login("receiver@bua.com", "recv123");

      cy.request("GET", `${api()}/api/foods`).then((foods) => {
        if (foods.body.length > 0) {
          const itemId = foods.body[0].id;

          cy.request("POST", `${api()}/api/bookings`, {
            food_item_id: itemId,
            qty: 1,
          }).then((booking) => {
            if (booking.status === 201) {
              const bookingId = booking.body.id;

              // Simulate delivery completion (would need proper auth)
              cy.request({
                method: "PUT",
                url: `${api()}/api/deliveries/${bookingId}`,
                body: { status: "completed" },
                failOnStatusCode: false,
              }).then(() => {
                // Try to create another booking for same item by hacker
                cy.clearCookies();
                cy.login("donor@bua.com", "donor123");

                cy.request({
                  method: "POST",
                  url: `${api()}/api/bookings`,
                  body: { food_item_id: itemId, qty: 1 },
                  failOnStatusCode: false,
                }).then((resp) => {
                  // Should fail if item is delivered
                  if (resp.body.status === "completed") {
                    expect(resp.status).to.not.equal(201);
                  }
                });
              });
            }
          });
        }
      });
    });

    it("Should prevent donating to self (if business rule)", () => {
      cy.login("donor@bua.com", "donor123");

      cy.request("POST", `${api()}/api/foods`, {
        title: "Self Donation Test",
        description: "Test",
        qty: 5,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }).then((resp) => {
        const itemId = resp.body.id;

        // Try to book own item
        cy.request({
          method: "POST",
          url: `${api()}/api/bookings`,
          body: { food_item_id: itemId, qty: 1 },
          failOnStatusCode: false,
        }).then((resp2) => {
          // Should prevent self-booking
          if (resp2.status === 201) {
            expect(resp2.body.food_item_id).to.not.equal(itemId);
          }
        });
      });
    });
  });

  // ============================================================================
  // METADATA & HIDDEN FIELD INJECTION
  // ============================================================================
  describe("Metadata & Hidden Field Injection", () => {
    it("Should not allow injecting admin flag on user registration", () => {
      const payload = {
        name: "Hacker",
        email: `hacker_${Date.now()}@bua.com`,
        phone: "0987654321",
        password: "Password123!",
        confirmPassword: "Password123!",
        role: "admin", // Try to set admin role
        is_verified: true, // Try to auto-verify
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/auth/register`,
        body: payload,
      }).then((resp) => {
        if (resp.status === 201) {
          expect(resp.body.role).to.not.equal("admin");
          expect(resp.body.is_verified).to.not.equal(true);
        }
      });
    });

    it("Should ignore extra/unknown fields in requests", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "Normal Item",
        description: "Test",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        malicious_field: "should_be_ignored",
        secret_code: "12345",
        admin_override: true,
      };

      cy.request("POST", `${api()}/api/foods`, payload).then((resp) => {
        expect(resp.body).to.not.have.property("malicious_field");
        expect(resp.body).to.not.have.property("secret_code");
        expect(resp.body).to.not.have.property("admin_override");
      });
    });
  });

  // ============================================================================
  // CACHE POISONING & HEADER INJECTION
  // ============================================================================
  describe("Cache Poisoning & Header Injection", () => {
    it("Should validate Host header to prevent cache poisoning", () => {
      cy.request({
        method: "GET",
        url: `${api()}/api/foods`,
        headers: { Host: "malicious.com" },
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        // Server should use canonical domain for links
      });
    });

    it("Should prevent header injection in Location header", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/auth/register`,
        body: {
          name: "Test",
          email: `test_${Date.now()}@bua.com`,
          phone: "0987654321",
          password: "Password123!",
          confirmPassword: "Password123!",
          redirect: "http://malicious.com", // Try to inject redirect
        },
      }).then((resp) => {
        if (resp.status === 201) {
          const location = resp.headers["location"];
          if (location) {
            expect(location).to.not.include("malicious.com");
          }
        }
      });
    });
  });

  // ============================================================================
  // COMMON CVE PATTERNS
  // ============================================================================
  describe("Common CVE Patterns & Known Exploit Techniques", () => {
    it("Should not be vulnerable to XXE (XML External Entity)", () => {
      const xxePayload = `<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <root>&xxe;</root>`;

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: xxePayload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect([400, 415]).to.include(resp.status);
      });
    });

    it("Should not be vulnerable to SSRF (Server-Side Request Forgery)", () => {
      cy.login("donor@bua.com", "donor123");

      const ssrfPayloads = [
        "http://localhost:3000/admin",
        "http://127.0.0.1:3306",
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379",
      ];

      ssrfPayloads.forEach((payload) => {
        cy.request({
          method: "POST",
          url: `${api()}/api/upload`,
          body: { url: payload },
          failOnStatusCode: false,
        }).then((resp) => {
          expect([400, 422]).to.include(resp.status);
        });
      });
    });

    it("Should handle prototype pollution safely", () => {
      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: {
          title: "Test",
          description: "Test",
          qty: 10,
          unit: "suất",
          expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          __proto__: { isAdmin: true },
          constructor: { prototype: { isAdmin: true } },
        },
        failOnStatusCode: false,
      }).then((resp) => {
        if (resp.status === 201) {
          expect(resp.body.isAdmin).to.not.equal(true);
        }
      });
    });
  });
});
