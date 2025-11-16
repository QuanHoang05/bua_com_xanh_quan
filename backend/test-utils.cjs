// Utilities để tạo dữ liệu test case chi tiết
// Sử dụng khi viết test để ghi nhận thông tin chi tiết

const fs = require("fs");
const path = require("path");

class TestDataCollector {
  constructor() {
    this.testCases = [];
    this.reportDir = path.resolve(process.cwd(), "test-reports");
  }

  // Ghi nhận một test case với thông tin chi tiết
  recordTestCase(data) {
    const testCase = {
      id: data.id || `TC-${Date.now()}`,
      testName: data.testName || "Unnamed Test",
      endpoint: data.endpoint || "N/A",
      method: data.method || "GET",
      preconditions: data.preconditions || "Setup môi trường test",
      input: data.input || "{}",
      expectedResult: data.expectedResult || "Status 200",
      environment: data.environment || "Test Environment",
      status: data.status || "pending", // pending, passed, failed
      actualResult: data.actualResult || "",
      duration: data.duration || 0,
      timestamp: new Date().toISOString(),
    };

    this.testCases.push(testCase);
  }

  // Lưu dữ liệu test vào file JSON
  saveTestData() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const dataFile = path.join(this.reportDir, `test-data-${timestamp}.json`);

    fs.writeFileSync(
      dataFile,
      JSON.stringify(this.testCases, null, 2),
      "utf-8"
    );
    console.log(`\n✅ Test data saved to: ${dataFile}`);
    return dataFile;
  }

  // Reset dữ liệu
  reset() {
    this.testCases = [];
  }
}

// Export singleton
const collector = new TestDataCollector();
module.exports = { TestDataCollector, collector };
