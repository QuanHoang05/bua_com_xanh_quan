// frontend/cypress/support/commands.js

/**
 * Gửi yêu cầu đến backend để reset và seed lại database test.
 * Lệnh này sẽ gọi đến endpoint đặc biệt /api/testing/reset.
 * Việc này đảm bảo mỗi test suite bắt đầu với một môi trường dữ liệu sạch,
 * giúp các test trở nên độc lập và đáng tin cậy.
 */
Cypress.Commands.add('resetDatabase', () => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('API_URL')}/api/testing/reset`,
    // Tăng timeout vì việc reset DB có thể mất vài giây
    timeout: 30000,
  }).then(response => {
    // Kiểm tra xem request có thành công không
    expect(response.status).to.eq(200);
    cy.log('Database reset and seeded successfully.');
  });
});

/**
 * Đăng nhập người dùng một cách có lập trình thông qua API.
 * - Nhanh hơn và ổn định hơn nhiều so với việc điền form UI cho mỗi test.
 * - Tách biệt việc test chức năng đăng nhập khỏi các test khác.
 *
 * @param {string} email - Email của người dùng (vd: 'admin@bua.com')
 * @param {string} password - Mật khẩu của người dùng
 */
Cypress.Commands.add('login', (email, password) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('API_URL')}/api/auth/login`,
    body: {
      email,
      password,
    },
  }).then(response => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('token');

    // Lưu token vào cookie để các request sau này được xác thực
    // Tên 'token' phải khớp với tên cookie/localStorage mà frontend của bạn sử dụng để xác thực
    cy.setCookie('token', response.body.token);

    // Nếu bạn dùng localStorage:
    // window.localStorage.setItem('token', response.body.token);

    cy.log('Logged in successfully via API.');
  });
});

// Import file này trong e2e.js để nó được load tự động
// (Điều này thường được cấu hình sẵn trong Cypress versions mới)
