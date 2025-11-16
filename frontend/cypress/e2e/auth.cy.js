/// <reference types="cypress" />

describe('Authentication Flow', () => {
  /**
   * `before` hook: Chạy một lần duy nhất trước tất cả các test trong `describe` block.
   * Chúng ta dùng nó để reset database về trạng thái ban đầu, đảm bảo
   * dữ liệu test (vd: tài khoản admin) luôn tồn tại và đúng như mong đợi.
   */
  before(() => {
    cy.resetDatabase();
  });

  /**
   * `beforeEach` hook: Chạy trước mỗi test case (mỗi `it` block).
   * - Dọn dẹp cookie/local storage để đảm bảo các test không ảnh hưởng lẫn nhau (vd: user session).
   * - Truy cập trang đăng nhập, là điểm bắt đầu chung cho hầu hết các test trong file này.
   */
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/login');
  });

  it('should display an error for invalid credentials', () => {
    // Test case này kiểm tra luồng đăng nhập thất bại qua UI.
    cy.get('input[name="email"]').type('wrong@user.com');
    cy.get('input[name="password"]').type('wrongpassword{enter}');

    // Chờ và kiểm tra thông báo lỗi.
    // Sử dụng timeout để Cypress chờ element xuất hiện nếu có hiệu ứng animation.
    cy.contains('Đăng nhập thất bại', { timeout: 10000 }).should('be.visible');
  });

  it('should log in successfully with valid admin credentials using the UI', () => {
    // Test case này kiểm tra luồng đăng nhập thành công của admin qua UI.
    // Lấy thông tin từ cypress.env.json hoặc biến môi trường.
    // Mật khẩu là 'password123' như trong file seed_test_db.sql
    cy.get('input[name="email"]').type('admin@bua.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('form').submit();

    // Sau khi đăng nhập, URL không còn là /login và trang phải hiển thị dấu hiệu đã đăng nhập.
    cy.url().should('not.include', '/login');
    cy.contains('Admin User').should('be.visible'); // Kiểm tra tên người dùng hiển thị
  });

  it('should log in programmatically and access a protected route', () => {
    // Test case này sử dụng custom command `cy.login` để đăng nhập qua API.
    // Cách này nhanh và ổn định, phù hợp cho các test không tập trung vào form đăng nhập.
    cy.login('admin@bua.com', 'password123');

    // Sau khi đăng nhập, truy cập thẳng vào một trang được bảo vệ của admin.
    cy.visit('/admin/dashboard');

    // Kiểm tra xem trang đã load đúng nội dung của trang admin.
    cy.contains('Tổng quan Dashboard').should('be.visible');
    cy.contains('Chào mừng, Admin User').should('be.visible');
  });

  it('should register a new user successfully and then log in', () => {
    // Test luồng đăng ký hoàn chỉnh.
    cy.visit('/register');

    // Sử dụng timestamp để đảm bảo email luôn là duy nhất cho mỗi lần chạy test.
    const uniqueEmail = `testuser_${Date.now()}@bua.com`;
    const password = 'Password123!';

    cy.get('input[name="name"]').type('Cypress Test User');
    cy.get('input[name="email"]').type(uniqueEmail);
    cy.get('input[name="phone"]').type('0987654321');
    cy.get('input[name="password"]').type(password);
    cy.get('input[name="confirmPassword"]').type(password); // Giả sử tên field là confirmPassword
    cy.get('form').submit();

    // Kiểm tra đăng ký thành công và chuyển hướng về trang chủ.
    cy.contains('Đăng ký thành công').should('be.visible');
    cy.url().should('not.include', '/register');

    // Dọn dẹp session để test đăng nhập lại với tài khoản vừa tạo.
    cy.clearCookies();
    cy.visit('/login');

    // Đăng nhập với tài khoản vừa tạo
    cy.get('input[name="email"]').type(uniqueEmail);
    cy.get('input[name="password"]').type(password + '{enter}');

    // Kiểm tra đăng nhập thành công
    cy.contains('Chào mừng, Cypress Test User').should('be.visible');
  });
});
