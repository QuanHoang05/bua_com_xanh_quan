/// <reference types="cypress" />

describe("Campaigns Page - Real Data", () => {
  beforeEach(() => {
    // Visit the page. The backend should be running in test mode.
    cy.visit("/campaigns");
  });

  it("should load and display the campaigns from the test database", () => {
    // Check for the main heading
    cy.contains("h1, h2, div", "Chiến dịch").should("be.visible");

    // Check that loading skeletons are eventually gone
    cy.get(".animate-pulse", { timeout: 10000 }).should("not.exist");

    // Check that exactly 2 campaign cards are displayed, as per seed_test_db.sql
    cy.get(".grid > div > div > .rounded-2xl").should("have.length", 2);

    // Check that the stats are calculated
    cy.contains("Người ủng hộ").next().should("not.have.text", "0");
    cy.contains("Đã gây quỹ").next().should("not.have.text", "0 đ");
  });

  it("should filter campaigns based on search input", () => {
    // Wait for campaigns to load
    cy.get(".animate-pulse", { timeout: 10000 }).should("not.exist");

    // Find the search input and type the name of a specific campaign from the seed data
    cy.get('input[placeholder="Tìm kiếm chiến dịch, địa điểm, tag…"]').type(
      "Mùa Hè Xanh"
    );

    // Only one campaign card should now be visible
    cy.get(".grid > div > div > .rounded-2xl").should("have.length", 1);
    cy.contains("Chiến dịch Mùa Hè Xanh").should("be.visible");
    cy.contains("Bữa Ăn 0 Đồng").should("not.exist");

    // Clear the search input
    cy.get('input[placeholder="Tìm kiếm chiến dịch, địa điểm, tag…"]').clear();

    // The number of campaign cards should return to 2
    cy.get(".grid > div > div > .rounded-2xl").should("have.length", 2);
  });

  it('should show a message when no campaigns match the search', () => {
    // Wait for campaigns to load
    cy.get(".animate-pulse", { timeout: 10000 }).should("not.exist");

    // Type a search query that won't match any campaign
    cy.get('input[placeholder="Tìm kiếm chiến dịch, địa điểm, tag…"]')
      .type('zzzzzzzzzzzz');

    // Assert that the "no campaigns" message is shown
    cy.contains('Chưa có chiến dịch phù hợp.').should('be.visible');
  });
});
