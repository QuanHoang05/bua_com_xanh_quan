#!/usr/bin/env node

/**
 * Script: Mở báo cáo test Integration HTML
 * Tạo bởi: IntegrationTest/runner.js → src/lib/reportGenerator.js
 * Sử dụng: npm run open:report
 *
 * Ghi chú (Tiếng Việt):
 * - Mở file test-report.html được tạo bởi IntegrationTest runner
 * - Fallback sang test-reports nếu file chính không tồn tại
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Thứ tự ưu tiên: test-report.html (tạo bởi IntegrationTest) → test-reports
const primaryReport = path.join(process.cwd(), "test-report.html");
const reportDir = path.join(process.cwd(), "test-reports");

let reportPath = null;

// Nếu file chính tồn tại, ưu tiên nó
if (fs.existsSync(primaryReport)) {
  reportPath = primaryReport;
} else if (fs.existsSync(reportDir)) {
  // Fallback: tìm file mới nhất trong test-reports
  const files = fs.readdirSync(reportDir);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));

  if (htmlFiles.length > 0) {
    const latestFile = htmlFiles.sort().pop();
    reportPath = path.join(reportDir, latestFile);
  }
}

if (!reportPath || !fs.existsSync(reportPath)) {
  console.log("\n❌ Không tìm thấy file báo cáo nào.");
  console.log("   Vui lòng chạy: npm run test:integration");
  console.log("   Hoặc: node IntegrationTest/runner.js all -v\n");
  process.exit(1);
}

console.log(`\n📂 Mở báo cáo Integration Tests: ${reportPath}`);
console.log(`📅 Thời gian: ${new Date().toLocaleString("vi-VN")}\n`);

// Mở file tùy theo OS (Ghi chú: Hỗ trợ Windows, macOS, Linux)
const platform = process.platform;

try {
  if (platform === "win32") {
    // Windows: dùng lệnh `start`
    execSync(`start "" "${reportPath}"`);
  } else if (platform === "darwin") {
    // macOS: dùng lệnh `open`
    execSync(`open "${reportPath}"`);
  } else {
    // Linux: dùng lệnh `xdg-open`
    execSync(`xdg-open "${reportPath}"`);
  }
  console.log("✅ Báo cáo đã được mở trong trình duyệt\n");
} catch (error) {
  console.log(`⚠️  Không thể mở file tự động. Vui lòng mở file này thủ công:`);
  console.log(`   ${reportPath}\n`);
  console.log(
    `   Hoặc truy cập khi server đang chạy: http://localhost:4000/test-report\n`
  );
}
