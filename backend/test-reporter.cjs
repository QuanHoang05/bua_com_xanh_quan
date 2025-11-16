// Báo cáo Test HTML tùy chỉnh cho Jest
// Tạo file HTML đẹp với thống kê kiểm thử

const fs = require("fs");
const path = require("path");

class HTMLReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
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

    // Trích xuất thông tin test từ kết quả
    const totalTests = results.numTotalTests;
    const passedTests = results.numPassedTests;
    const failedTests = results.numFailedTests;
    const duration = results.testResults.reduce(
      (sum, r) => sum + (r.perfStats.end - r.perfStats.start),
      0
    );

    let testRows = "";
    let suiteIndex = 1;

    // Build table rows from test results
    (results.testResults || []).forEach((suite) => {
      const suiteName = suite.name
        ? path.basename(suite.name)
        : `Suite ${suiteIndex}`;
      const assertionResults = suite.assertionResults || [];

      assertionResults.forEach((assertion, idx) => {
        const status = assertion.status === "passed" ? "✅ Pass" : "❌ Fail";
        const statusClass =
          assertion.status === "passed" ? "status-pass" : "status-fail";
        const duration = assertion.duration || 0;

        testRows += `
        <tr class="${statusClass}">
          <td>TC-${suiteIndex}-${idx + 1}</td>
          <td>${suiteName}</td>
          <td>${assertion.title || "No title"}</td>
          <td>Điều kiện test được thiết lập</td>
          <td>Dữ liệu kiểm thử</td>
          <td>Kết quả mong muốn</td>
          <td>${status}</td>
          <td>${duration}ms</td>
        </tr>`;
      });

      suiteIndex++;
    });

    const passRate =
      totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0;
    const failureRate =
      totalTests > 0 ? ((failedTests / totalTests) * 100).toFixed(2) : 0;

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 Báo Cáo Kiểm Thử - Bữa Cơm Xanh</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .header p {
      font-size: 1.1em;
      opacity: 0.95;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card.success { border-left-color: #10b981; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-card.info { border-left-color: #3b82f6; }
    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }
    .stat-label {
      color: #6b7280;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-card.success .stat-value { color: #10b981; }
    .stat-card.danger .stat-value { color: #ef4444; }
    .stat-card.info .stat-value { color: #3b82f6; }
    .stat-card.warning .stat-value { color: #f59e0b; }
    .content {
      padding: 30px;
    }
    .section-title {
      font-size: 1.5em;
      margin: 30px 0 20px 0;
      color: #1f2937;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      background: white;
    }
    thead {
      background: #f3f4f6;
      border-bottom: 2px solid #e5e7eb;
    }
    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 0.9em;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .status-pass {
      background: #f0fdf4;
    }
    .status-pass td:last-child {
      color: #10b981;
      font-weight: 600;
    }
    .status-fail {
      background: #fef2f2;
    }
    .status-fail td:last-child {
      color: #ef4444;
      font-weight: 600;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
      border-top: 1px solid #e5e7eb;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e5e7eb;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
      display: flex;
      align-items: center;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 0.85em;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
      margin: 5px 2px;
    }
    .badge-pass { background: #d1fae5; color: #065f46; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-skip { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Báo Cáo Kiểm Thử - Bữa Cơm Xanh</h1>
      <p>Kết quả chạy test lúc ${new Date().toLocaleString("vi-VN")}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card info">
        <div class="stat-label">Tổng Kiểm Thử</div>
        <div class="stat-value">${totalTests}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Thành Công</div>
        <div class="stat-value">${passedTests}</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-label">Thất Bại</div>
        <div class="stat-value">${failedTests}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Thời Gian</div>
        <div class="stat-value">${(duration / 1000).toFixed(2)}s</div>
      </div>
    </div>

    <div class="content">
      <h2 class="section-title">📈 Tỷ Lệ Thành Công</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${passRate}%">
          ${passRate}%
        </div>
      </div>
      <p style="margin-top: 10px; color: #6b7280;">
        <span class="badge badge-pass">✅ Thành công: ${passedTests}</span>
        <span class="badge badge-fail">❌ Thất bại: ${failedTests}</span>
      </p>

      <h2 class="section-title">📋 Chi Tiết Kiểm Thử</h2>
      <table>
        <thead>
          <tr>
            <th>ID Kiểm Thử</th>
            <th>Bộ Kiểm Thử</th>
            <th>Tên Kiểm Thử</th>
            <th>Điều Kiện Tiên Quyết</th>
            <th>Dữ Liệu Nhập</th>
            <th>Kết Quả Mong Muốn</th>
            <th>Trạng Thái</th>
            <th>Thời Gian (ms)</th>
          </tr>
        </thead>
        <tbody>
          ${
            testRows ||
            '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #9ca3af;">Không có kiểm thử nào</td></tr>'
          }
        </tbody>
      </table>

      <h2 class="section-title">📝 Tóm Tắt</h2>
      <p style="color: #4b5563; line-height: 1.8;">
        <strong>Ngày chạy:</strong> ${new Date().toLocaleString("vi-VN")}<br>
        <strong>Tổng kiểm thử:</strong> ${totalTests}<br>
        <strong>Kiểm thử thành công:</strong> ${passedTests} (${passRate}%)<br>
        <strong>Kiểm thử thất bại:</strong> ${failedTests} (${failureRate}%)<br>
        <strong>Thời gian thực thi:</strong> ${(duration / 1000).toFixed(
          2
        )} giây<br>
      </p>
    </div>

    <div class="footer">
      <p>Báo cáo được tạo tự động bởi Jest HTML Reporter | Bữa Cơm Xanh Project</p>
      <p>Generated: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportFile, html, "utf-8");
    console.log(`\n✅ Báo cáo test HTML đã được tạo: ${reportFile}`);
  }
}

module.exports = HTMLReporter;
