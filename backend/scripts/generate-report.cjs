const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'test-logs');
const reportFile = path.join(__dirname, '..', 'test-report.html');

const logFiles = [
  'npm-test-unit-sqlite.log',
  'npm-test-unit-mysql.log',
  'npm-test-integration.log',
];

let combinedLog = `
<h1>Test Report</h1>
<pre><code>
`;

logFiles.forEach(file => {
  const filePath = path.join(logDir, file);
  if (fs.existsSync(filePath)) {
    combinedLog += `\n\n--- START: ${file} ---\n\n`;
    combinedLog += fs.readFileSync(filePath, 'utf8');
    combinedLog += `\n\n--- END: ${file} ---\n\n`;
  }
});

combinedLog += '</code></pre>';

fs.writeFileSync(reportFile, combinedLog);
console.log(`✅ Báo cáo tổng hợp đã được tạo tại: ${reportFile}`);