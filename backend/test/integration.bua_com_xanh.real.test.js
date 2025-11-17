/*
  Shim file để tránh chạy test tích hợp mặc định trong pipeline của BE/FE.
  - Nếu bạn muốn chạy test này, đặt biến môi trường `RUN_INTEGRATION_TESTS=1` trước khi chạy Jest.
  - Khi biến không được bật, test sẽ bị skip và không ảnh hưởng tới các test khác.
  - Nếu bật, file thật nằm trong `IntegrationTest/` sẽ được import và thực thi.
*/

if (process.env.RUN_INTEGRATION_TESTS === "1") {
  // Khi bật rõ ràng, import file test thật nằm ở thư mục IntegrationTest
  (async () => {
    try {
      await import("../IntegrationTest/integration.bua_com_xanh.real.test.js");
      console.log(
        "[integration-shim] Integration tests imported and will run."
      );
    } catch (err) {
      console.error(
        "[integration-shim] Failed to import integration tests:",
        err && err.stack ? err.stack : err
      );
      throw err;
    }
  })();
} else {
  // Khi không bật, đăng ký một suite skip để báo rõ ràng trong kết quả test
  describe.skip("Integration tests (disabled)", () => {
    test("skipped - enable with RUN_INTEGRATION_TESTS=1", () => {
      expect(true).toBe(true);
    });
  });
  console.log(
    "[integration-shim] Integration tests are disabled. To enable, set RUN_INTEGRATION_TESTS=1."
  );
}
