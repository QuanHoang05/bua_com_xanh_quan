#!/usr/bin/env node

/**
 * Script: Mở báo cáo test HTML mới nhất
 * Sử dụng: npm run open:report
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Tìm thư mục test-reports
const reportDir = path.join(process.cwd(), "test-reports");

if (!fs.existsSync(reportDir)) {
  console.log("❌ Không tìm thấy thư mục test-reports");
  process.exit(1);
}

// Tìm file báo cáo mới nhất
const files = fs.readdirSync(reportDir);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

if (htmlFiles.length === 0) {
  console.log("❌ Không tìm thấy file báo cáo HTML nào");
  process.exit(1);
}

// Sắp xếp theo thời gian, lấy file mới nhất
const latestFile = htmlFiles.sort().pop();
const reportPath = path.join(reportDir, latestFile);

console.log(`\n📂 Mở báo cáo: ${reportPath}`);
console.log(`📅 File: ${latestFile}\n`);

// Mở file tùy theo OS
const platform = process.platform;

try {
  if (platform === "win32") {
    // Windows
    execSync(`start "" "${reportPath}"`);
  } else if (platform === "darwin") {
    // macOS
    execSync(`open "${reportPath}"`);
  } else {
    // Linux
    execSync(`xdg-open "${reportPath}"`);
  }
  console.log("✅ Báo cáo đã được mở trong trình duyệt\n");
} catch (error) {
  console.log(`⚠️  Không thể mở file tự động. Vui lòng mở file này thủ công:`);
  console.log(`   ${reportPath}\n`);
}
