// Jest HTML Reporter với Chi Tiết Test Case
// Hiển thị: Test Case ID, Endpoint, Pre-condition, Input, Expected Result, Environment, Status, Actual Result

const fs = require("fs");
const path = require("path");

class DetailedHTMLReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
  }

  // Extract endpoint từ test title
  extractEndpoint(title) {
    const matches = title.match(/(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/i);
    if (matches) return `${matches[1]} ${matches[2]}`;

    const pathMatch = title.match(/\/[\w\/\-\:?=&]*/);
    if (pathMatch) return pathMatch[0];

    return "N/A";
  }

  // Extract environment từ test description
  extractEnvironment(suiteName) {
    if (!suiteName) return "Test Environment";
    if (suiteName.includes("SQLite") || suiteName.includes("sqlite"))
      return "SQLite";
    if (suiteName.includes("MySQL") || suiteName.includes("mysql"))
      return "MySQL";
    if (suiteName.includes("Performance")) return "Performance";
    if (suiteName.includes("Security")) return "Security";
    return "Test Environment";
  }

  // Tạo Test Case ID từ suite + index
  generateTestCaseId(suiteName, index) {
    const suiteShort = suiteName
      .replace(".test.js", "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .substring(0, 3)
      .toUpperCase();

    return `${suiteShort}-${String(index).padStart(2, "0")}`;
  }

  // Clean up old reports, keeping only N most recent
  cleanupOldReports(reportDir, keepCount = 3) {
    try {
      const files = fs
        .readdirSync(reportDir)
        .filter((f) => f.startsWith("test-report-") && f.endsWith(".html"))
        .map((f) => ({
          name: f,
          path: path.join(reportDir, f),
          mtime: fs.statSync(path.join(reportDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Delete files beyond keepCount
      if (files.length > keepCount) {
        files.slice(keepCount).forEach((file) => {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️  Deleted old report: ${file.name}`);
          } catch (e) {
            console.warn(`⚠️  Failed to delete ${file.name}: ${e.message}`);
          }
        });
      }
    } catch (e) {
      console.warn(`⚠️  Error cleaning up old reports: ${e.message}`);
    }
  }

  onRunComplete(contexts, results) {
    const reportDir = path.resolve(process.cwd(), "test-reports");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const reportFile = path.join(reportDir, `test-report-${timestamp}.html`);

    const totalTests = results.numTotalTests;
    const passedTests = results.numPassedTests;
    const failedTests = results.numFailedTests;
    const duration = results.testResults.reduce(
      (sum, r) => sum + (r.perfStats.end - r.perfStats.start),
      0
    );

    let testRows = "";
    let globalTestIndex = 1;

    // Collect failure details to show at bottom of report
    let failuresHtml = "";

    // Build detailed table rows
    (results.testResults || []).forEach((suite) => {
      const suiteName = suite.name
        ? path.basename(suite.name)
        : "Unknown Suite";
      const environment = this.extractEnvironment(suite.name);
      const assertionResults = suite.assertionResults || [];

      // collect failures for this suite
      assertionResults.forEach((assertion) => {
        if (assertion.status !== "passed") {
          const messages = (assertion.failureMessages || []).join(
            "\n\n---\n\n"
          );
          const safeMsg = String(messages)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");

          failuresHtml +=
            `\n<section style="margin-bottom:18px;padding:12px;border-radius:8px;background:#fff4f4;border:1px solid #fee2e2;">` +
            `<h4 style="margin:0 0 8px 0;color:#991b1b">❌ ${suiteName} - ${assertion.title}</h4>` +
            `<div style="font-family:monospace;font-size:0.85em;color:#111">${safeMsg}</div>` +
            `</section>`;
        }
      });

      assertionResults.forEach((assertion, idx) => {
        const testCaseId = this.generateTestCaseId(suiteName, globalTestIndex);
        const endpoint = this.extractEndpoint(assertion.title);
        const status = assertion.status === "passed" ? "Passed" : "Failed";
        const statusBg = assertion.status === "passed" ? "#d1fae5" : "#fee2e2";
        const statusColor =
          assertion.status === "passed" ? "#065f46" : "#991b1b";
        const statusIcon = assertion.status === "passed" ? "✅" : "❌";
        const duration = assertion.duration || 0;

        // Extract pre-condition từ test title
        let precondition = "Admin token provided";
        if (assertion.title.includes("unauthenticated"))
          precondition = "No authentication";
        if (assertion.title.includes("unauthorized"))
          precondition = "User unauthorized";
        if (assertion.title.includes("invalid")) precondition = "Invalid input";

        testRows += `
        <tr>
          <td class="cell-id">${testCaseId}</td>
          <td class="cell-endpoint">${endpoint}</td>
          <td class="cell-precondition">${precondition}</td>
          <td class="cell-input">
            <small class="env-badge env-${environment.toLowerCase()}">${environment}</small>
            Data setup & mocked DB
          </td>
          <td class="cell-expected">Status 200, Valid response</td>
          <td class="cell-env">${environment}</td>
          <td class="cell-status">
            <span class="status-badge" style="background-color: ${statusBg}; color: ${statusColor};">
              ${statusIcon} ${status}
            </span>
          </td>
          <td class="cell-actual">
            <span class="duration">${duration}ms</span>
            <span class="test-name">${assertion.title}</span>
          </td>
        </tr>`;

        globalTestIndex++;
      });
    });

    const passRate =
      totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    const failureRate =
      totalTests > 0 ? ((failedTests / totalTests) * 100).toFixed(1) : 0;

    // Prepare test result summary
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // Read the current test log file
    const logDir = path.resolve(process.cwd(), "test-logs");
    let shortLogHtml = "";

    // Try to read log file - check both backend and frontend possible locations
    // For backend: npm-test.log, for frontend: jest-test.log
    const logFile = path.join(
      logDir,
      fs.existsSync(path.join(logDir, "npm-test.log"))
        ? "npm-test.log"
        : "jest-test.log"
    );

    if (fs.existsSync(logFile)) {
      try {
        const logContent = fs.readFileSync(logFile, "utf-8");
        shortLogHtml = escapeHtml(logContent).substring(0, 10000);
      } catch (e) {
        shortLogHtml = "Error reading log file: " + e.message;
      }
    } else {
      // Fallback: build summary from test results if no log file found
      shortLogHtml = (results.testResults || [])
        .map((suite) => {
          const suitePath = suite.name
            ? suite.name.replace(process.cwd(), "")
            : "Unknown";
          const assertions = (suite.assertionResults || [])
            .map(
              (a) =>
                `  ${a.status === "passed" ? "✓" : "✗"} ${a.title} (${
                  a.duration || 0
                }ms)`
            )
            .join("\n");
          return `${suitePath}\n${assertions}`;
        })
        .join("\n\n");
      shortLogHtml = escapeHtml(shortLogHtml).substring(0, 10000);
    }

    const shortLogHtmlEscaped = shortLogHtml;

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Báo Cáo Kiểm Thử Chi Tiết - Bữa Cơm Xanh</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
      color: #333;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.2);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120"><path d="M0,50 Q300,10 600,50 T1200,50 L1200,120 L0,120 Z" fill="rgba(255,255,255,0.1)"></path></svg>') repeat-x;
      opacity: 0.5;
    }

    .header-content {
      position: relative;
      z-index: 1;
    }

    .header h1 {
      font-size: 2.8em;
      margin-bottom: 10px;
      font-weight: 700;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
    }

    .header p {
      font-size: 1.1em;
      opacity: 0.95;
      margin-bottom: 20px;
    }

    .header-meta {
      font-size: 0.95em;
      opacity: 0.85;
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      padding: 30px;
      background: linear-gradient(to right, #f8f9fa, #f0f1f5);
    }

    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      border-left: 5px solid #667eea;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.12);
    }

    .stat-card.success { border-left-color: #10b981; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-card.info { border-left-color: #3b82f6; }
    .stat-card.warning { border-left-color: #f59e0b; }

    .stat-label {
      color: #6b7280;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 2.5em;
      font-weight: 800;
      margin: 8px 0;
    }

    .stat-card.success .stat-value { color: #10b981; }
    .stat-card.danger .stat-value { color: #ef4444; }
    .stat-card.info .stat-value { color: #3b82f6; }
    .stat-card.warning .stat-value { color: #f59e0b; }

    .stat-desc {
      font-size: 0.9em;
      color: #9ca3af;
    }

    .content {
      padding: 40px;
    }

    .section-title {
      font-size: 1.8em;
      margin: 0 0 25px 0;
      color: #1f2937;
      font-weight: 700;
      border-bottom: 3px solid #667eea;
      padding-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .progress-section {
      background: linear-gradient(135deg, #f8f9fa, #f0f1f5);
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 40px;
    }

    .progress-bar {
      width: 100%;
      height: 35px;
      background: #e5e7eb;
      border-radius: 20px;
      overflow: hidden;
      margin: 15px 0;
      display: flex;
      align-items: center;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 0.9em;
      transition: width 0.5s ease;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.95em;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.85em;
      font-weight: 600;
      margin: 5px 5px 5px 0;
    }

    .badge-pass { background: #d1fae5; color: #065f46; }
    .badge-fail { background: #fee2e2; color: #991b1b; }

    /* Table Styles */
    .table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      margin-bottom: 30px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    thead {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    th {
      padding: 16px 12px;
      text-align: left;
      font-weight: 700;
      font-size: 0.9em;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    td {
      padding: 14px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 0.9em;
    }

    tbody tr {
      transition: background-color 0.2s ease;
    }

    tbody tr:hover {
      background: #f8fafc;
    }

    tbody tr:nth-child(even) {
      background: #f9fafb;
    }

    .cell-id {
      font-weight: 700;
      color: #667eea;
      font-family: 'Courier New', monospace;
      font-size: 0.95em;
    }

    .cell-endpoint {
      font-family: 'Courier New', monospace;
      color: #1f2937;
      font-weight: 600;
      font-size: 0.9em;
    }

    .cell-precondition {
      color: #6b7280;
      font-size: 0.85em;
    }

    .cell-expected {
      color: #059669;
      font-weight: 500;
    }

    .cell-env {
      text-align: center;
      font-weight: 600;
    }

    .cell-status {
      text-align: center;
    }

    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.85em;
      white-space: nowrap;
    }

    .cell-actual {
      font-size: 0.85em;
    }

    .cell-input {
      font-size: 0.85em;
      color: #6b7280;
    }

    .env-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 700;
      margin-right: 8px;
      color: white;
    }

    .env-sqlite { background: #3b82f6; }
    .env-mysql { background: #f59e0b; }
    .env-performance { background: #8b5cf6; }
    .env-security { background: #ef4444; }

    .duration {
      display: block;
      color: #667eea;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .test-name {
      display: block;
      color: #9ca3af;
      font-style: italic;
      font-size: 0.8em;
      margin-top: 4px;
    }

    .summary {
      background: linear-gradient(135deg, #f8f9fa, #f0f1f5);
      padding: 25px;
      border-radius: 12px;
      margin: 30px 0;
    }

    .summary h3 {
      margin-bottom: 15px;
      color: #1f2937;
      font-size: 1.2em;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .summary-item {
      padding: 15px;
      background: white;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .summary-item strong {
      display: block;
      color: #667eea;
      margin-bottom: 5px;
      font-weight: 700;
    }

    .footer {
      background: linear-gradient(135deg, #1f2937, #374151);
      color: white;
      padding: 30px;
      text-align: center;
      font-size: 0.9em;
    }

    .footer p {
      margin: 8px 0;
      opacity: 0.9;
    }

    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      .header { page-break-after: avoid; }
    }

    @media (max-width: 768px) {
      .header h1 { font-size: 1.8em; }
      .stats-grid { grid-template-columns: 1fr; }
      table { font-size: 0.8em; }
      td, th { padding: 10px 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1>📊 Báo Cáo Kiểm Thử Chi Tiết</h1>
        <p>Bữa Cơm Xanh - Test Results Report</p>
        <div class="header-meta">
          <div class="meta-item">
            <span>📅 ${new Date().toLocaleString("vi-VN")}</span>
          </div>
          <div class="meta-item">
            <span>⏱️ ${(duration / 1000).toFixed(2)}s</span>
          </div>
          <div class="meta-item">
            <span>🧪 ${totalTests} tests</span>
          </div>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card info">
        <div class="stat-label">Tổng Kiểm Thử</div>
        <div class="stat-value">${totalTests}</div>
        <div class="stat-desc">Test cases executed</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">✅ Thành Công</div>
        <div class="stat-value">${passedTests}</div>
        <div class="stat-desc">${passRate}% success rate</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-label">❌ Thất Bại</div>
        <div class="stat-value">${failedTests}</div>
        <div class="stat-desc">${failureRate}% failure rate</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">⏱️ Thời Gian</div>
        <div class="stat-value">${(duration / 1000).toFixed(2)}s</div>
        <div class="stat-desc">Total execution time</div>
      </div>
    </div>

    <div class="content">
      <div class="progress-section">
        <div class="section-title">📈 Tỷ Lệ Thành Công</div>
        <div class="progress-label">
          <span>Progress</span>
          <span>${passRate}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${passRate}%">
            ${passRate > 5 ? passRate + "%" : ""}
          </div>
        </div>
        <div style="display: flex; gap: 15px; margin-top: 15px;">
          <span class="badge badge-pass">✅ Passed: ${passedTests}</span>
          <span class="badge badge-fail">❌ Failed: ${failedTests}</span>
        </div>
      </div>

      <div class="section-title">📋 Kết quả</div>
      <div style="background:#f5f5f5;padding:15px;border-radius:8px;border-left:4px solid #667eea;overflow-x:auto;max-height:400px;overflow-y:auto;">
        <pre style="margin:0;font-family:monospace;font-size:0.85em;color:#333;white-space:pre-wrap;word-break:break-word;">${shortLogHtmlEscaped}</pre>
      </div>

      <div class="summary">
        <h3>📝 Tóm Tắt Kiểm Thử</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Ngày Chạy</strong>
            ${new Date().toLocaleString("vi-VN")}
          </div>
          <div class="summary-item">
            <strong>Tổng Test Cases</strong>
            ${totalTests}
          </div>
          <div class="summary-item">
            <strong>Thành Công</strong>
            ${passedTests} (${passRate}%)
          </div>
          <div class="summary-item">
            <strong>Thất Bại</strong>
            ${failedTests} (${failureRate}%)
          </div>
          <div class="summary-item">
            <strong>Thời Gian Thực Thi</strong>
            ${(duration / 1000).toFixed(2)} giây
          </div>
          <div class="summary-item">
            <strong>Trạng Thái Chung</strong>
            ${failedTests === 0 ? "✅ Passed All" : "⚠️ Some Failed"}
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>📊 Báo cáo kiểm thử - Kết quả test</p>
      <p>🏢 Bữa Cơm Xanh - QA Report</p>
      <p style="margin-top: 15px; opacity: 0.85;">Generated: ${new Date().toLocaleString(
        "vi-VN"
      )}</p>
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportFile, html, "utf-8");

    console.log(`\n✅ Chi tiết báo cáo test đã được tạo: ${reportFile}`);

    // Clean up old reports AFTER creating new one - keep only 3 most recent
    this.cleanupOldReports(reportDir, 3);

    // Show cleanup status
    try {
      const remainingReports = fs
        .readdirSync(reportDir)
        .filter(
          (f) => f.startsWith("test-report-") && f.endsWith(".html")
        ).length;
      console.log(
        `📊 Tổng báo cáo được giữ lại: ${remainingReports} (tối đa 3)`
      );
    } catch (e) {
      // ignore
    }
  }
}

module.exports = DetailedHTMLReporter;
