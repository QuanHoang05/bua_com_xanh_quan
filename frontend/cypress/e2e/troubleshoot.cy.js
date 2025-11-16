describe('Cypress Troubleshoot', () => {
  it('visits the base URL', () => {
    cy.visit('/');
    cy.contains('h1', 'Vite + React');
  });
});
