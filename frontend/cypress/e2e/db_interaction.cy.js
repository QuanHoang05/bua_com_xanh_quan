/// <reference types="cypress" />

/**
 * db_interaction.cy.js
 * Ví dụ cách dùng `cy.request()` + `cy.resetDatabase()` để tương tác với DB qua API.
 * Trường hợp: kiểm thử API tạo `food_items` theo kỹ thuật ECP (Equivalence Classes)
 * và BAV (Boundary Value Analysis).
 *
 * Lưu ý an toàn:
 * - Các endpoint reset/seed chỉ hoạt động khi backend chạy với `NODE_ENV=test`.
 * - Thiết lập `CYPRESS_BASE_URL` và `API_URL` trỏ tới môi trường test (không phải production).
 */

describe("DB Interaction via cy.request() (ECP + BAV examples)", () => {
  // Chạy 1 lần trước toàn bộ suite: đảm bảo DB ở trạng thái seed chuẩn
  before(() => {
    cy.resetDatabase();
  });

  // Trước mỗi test case, dọn cookie & localStorage
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  const api = () => Cypress.env("API_URL") || Cypress.config("baseUrl");

  context("ECP - Equivalence Class Partitioning for `qty` field", () => {
    it("Accepts a typical valid quantity (class: valid positive integer)", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "ECP Test Item - valid",
        description: "Test item for ECP valid class",
        qty: 10,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
      }).then((resp) => {
        expect(resp.status).to.eq(201);
        expect(resp.body).to.have.property("id");
      });
    });

    it("Rejects negative quantity (class: invalid negative)", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "ECP Test Item - negative",
        description: "Negative qty should be rejected",
        qty: -5,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 422]);
      });
    });

    it("Rejects non-integer quantity (class: invalid format)", () => {
      cy.login("donor@bua.com", "donor123");

      const payload = {
        title: "ECP Test Item - float",
        description: "Float qty should be rejected if API requires integer",
        qty: 3.14,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 422]);
      });
    });
  });

  context("BAV - Boundary Value Analysis for `qty` limits", () => {
    // Giả sử yêu cầu: qty tối thiểu 1, tối đa 1000
    const MIN = 1;
    const MAX = 1000;

    it("Accepts qty = MIN", () => {
      cy.login("donor@bua.com", "donor123");
      const payload = {
        title: "BAV - qty=min",
        description: "Boundary min",
        qty: MIN,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request("POST", `${api()}/api/foods`, payload).then((resp) => {
        expect(resp.status).to.eq(201);
      });
    });

    it("Rejects qty = MIN - 1", () => {
      cy.login("donor@bua.com", "donor123");
      const payload = {
        title: "BAV - qty=min-1",
        description: "Boundary min-1",
        qty: MIN - 1,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 422]);
      });
    });

    it("Accepts qty = MAX", () => {
      cy.login("donor@bua.com", "donor123");
      const payload = {
        title: "BAV - qty=max",
        description: "Boundary max",
        qty: MAX,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request("POST", `${api()}/api/foods`, payload).then((resp) => {
        expect(resp.status).to.eq(201);
      });
    });

    it("Rejects qty = MAX + 1", () => {
      cy.login("donor@bua.com", "donor123");
      const payload = {
        title: "BAV - qty=max+1",
        description: "Boundary max+1",
        qty: MAX + 1,
        unit: "suất",
        expire_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };

      cy.request({
        method: "POST",
        url: `${api()}/api/foods`,
        body: payload,
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.be.oneOf([400, 422]);
      });
    });
  });
});
