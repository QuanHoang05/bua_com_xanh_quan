#!/usr/bin/env node
/**
 * Integration Test Runner - Trình chạy tất cả integration tests
 *
 * Ghi chú (Tiếng Việt):
 * - Orchestrate chạy các test suites (auth, metrics, campaigns, users, admin)
 * - Tự động seed MySQL database trước khi chạy (src/seed_mysql.js)
 * - Ghi lỗi vào errorIntegration.md + test-logs/integration-test.log (reuse log structure)
 * - Tạo báo cáo HTML test-report.html để xem nhanh
 *
 * Cách sử dụng:
 *   node runner.js          # Chạy tất cả suites
 *   node runner.js all      # Chạy tất cả suites (cách 2)
 *   node runner.js auth     # Chạy auth tests
 *   node runner.js campaigns -v # Chạy campaigns với verbose output
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { generateReport } from "../src/lib/reportGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test suite definitions with real data integration tests
const suites = {
  auth: {
    name: "Authentication Tests",
    file: "tests/01-auth.integration.test.js",
    description: "Register, Login, Get Profile, Change Password",
  },
  metrics: {
    name: "Admin Metrics Tests",
    file: "tests/02-metrics.integration.test.js",
    description: "Delivery Stats, Heatmap, Donor/Campaign Metrics",
  },
  campaigns: {
    name: "Campaign Tests",
    file: "tests/03-campaigns.integration.test.js",
    description: "List, Details, Filter, Search, Sort, Donate",
  },
  users: {
    name: "User Tests",
    file: "tests/04-users.integration.test.js",
    description: "Profile, History, Activity, Settings",
  },
  admin: {
    name: "Admin User Management Tests",
    file: "tests/05-admin-users.integration.test.js",
    description: "List, Details, Update, Ban/Unban, Roles",
  },
};

const args = process.argv.slice(2);
const suiteName = (args[0] || "all").toLowerCase();
const verbose = args.includes("-v") || args.includes("--verbose");

let suitesToRun = [];

if (suiteName === "all" || suiteName === "") {
  suitesToRun = Object.entries(suites).map(([key, val]) => ({ key, ...val }));
} else if (suites[suiteName]) {
  suitesToRun = [{ key: suiteName, ...suites[suiteName] }];
} else {
  console.error(`❌ Unknown test suite: ${suiteName}`);
  console.log("\n📋 Available suites:");
  Object.entries(suites).forEach(([key, suite]) => {
    console.log(`  ${key.padEnd(12)} - ${suite.name}`);
    console.log(`                 ${suite.description}`);
  });
  process.exit(1);
}

console.log("\n");
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║         🧪 INTEGRATION TEST RUNNER (REAL DATA)             ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log(`\n📊 Running: ${suitesToRun.map((s) => s.name).join(", ")}`);
console.log(`🗂️  Directory: ${__dirname}`);
console.log(`📝 Environment: MySQL Real Database`);
console.log(`⏱️  Timeout: 30 seconds per test\n`);

// Track test results
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let errors = [];

/**
 * Run a single test file
 */
async function runTestSuite(suite) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, suite.file);

    if (!fs.existsSync(testPath)) {
      console.log(`\n⚠️  Test file not found: ${testPath}`);
      console.log(`   Creating stub...\n`);
      resolve({ passed: 0, failed: 1, tests: 0 });
      return;
    }

    console.log(`${"─".repeat(64)}`);
    console.log(`▶️  ${suite.name}`);
    console.log(`${"─".repeat(64)}`);

    const proc = spawn("node", [testPath], {
      stdio: verbose ? "inherit" : "pipe",
      cwd: __dirname,
      timeout: 30000,
    });

    let stdout = "";
    let stderr = "";

    if (!verbose) {
      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
    }

    proc.on("close", (code) => {
      // Always print per-test status lines from stdout (makes output similar to verbose)
      if (stdout) {
        // extract meaningful lines: those containing ✅, ❌, SKIP, PASS, FAIL, or test IDs
        const lines = stdout.split(/\r?\n/);
        const interesting = lines.filter((l) =>
          /✅|❌|SKIP|PASS|FAIL|AUTH-|ADMN-|CAMP-|USER-|ADMIN-/.test(l)
        );
        if (interesting.length > 0) {
          console.log("\n  Test details:");
          interesting.forEach((l) => console.log("   ", l));
          console.log("");
        } else if (verbose) {
          // If verbose, print full stdout
          console.log(stdout);
        }
      }

      if (code === 0) {
        console.log(`✅ ${suite.key.toUpperCase()} - PASSED\n`);
        passedTests++;
        resolve({ passed: 1, failed: 0, key: suite.key });
      } else {
        console.log(`❌ ${suite.key.toUpperCase()} - FAILED\n`);
        failedTests++;
        // store both stdout and stderr for richer error report
        errors.push({
          suite: suite.key,
          stdout: stdout || "",
          stderr: stderr || "",
        });
        resolve({ passed: 0, failed: 1, key: suite.key });
      }
    });

    proc.on("error", (err) => {
      console.log(`❌ Error running ${suite.key}:`, err.message);
      failedTests++;
      errors.push({ suite: suite.key, error: err.message });
      resolve({ passed: 0, failed: 1, key: suite.key });
    });
  });
}

/**
 * Run all test suites sequentially
 */
async function runAllTests() {
  // Pre-run: if using MySQL, run the seed script to ensure campaigns/users/donations exist
  try {
    if ((process.env.DB_DRIVER || "mysql").toLowerCase() === "mysql") {
      console.log(
        "\n🔁 Pre-run seeding: running src/seed_mysql.js to prepare DB..."
      );
      const seedPath = path.join(__dirname, "..", "src", "seed_mysql.js");
      if (fs.existsSync(seedPath)) {
        // spawn and wait for completion
        await new Promise((res) => {
          const sproc = spawn("node", [seedPath], {
            cwd: path.join(__dirname, ".."),
          });
          sproc.stdout?.on("data", (d) =>
            process.stdout.write(`[seed] ${d.toString()}`)
          );
          sproc.stderr?.on("data", (d) =>
            process.stderr.write(`[seed] ${d.toString()}`)
          );
          sproc.on("close", () => res());
          sproc.on("error", () => res());
        });
        console.log("🔁 Pre-run seeding complete.");
      } else {
        console.log("⚠️  Seed script not found at", seedPath);
      }
    }
  } catch (e) {
    console.warn(
      "⚠️  Pre-seed step failed (continuing):",
      e && e.message ? e.message : e
    );
  }

  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    totalTests += result.passed + result.failed;
  }

  // Print summary
  printSummary();

  // Always call report generation to produce HTML summary for quick viewing
  try {
    // Nếu có lỗi, writeErrorReport() sẽ gọi generateReport() bên trong
    if (errors.length > 0) {
      writeErrorReport();
    } else {
      // Nếu không có lỗi, vẫn gọi generateReport() để cập nhật HTML từ file markdown hiện có
      const gen = generateReport();
      if (gen && gen.ok)
        console.log(`📄 HTML report generated at: ${gen.path}`);
    }
  } catch (e) {
    console.warn(
      "⚠️ Lỗi khi tạo báo cáo HTML:",
      e && e.message ? e.message : e
    );
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

/**
 * Print test summary
 */
function printSummary() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                     📊 TEST SUMMARY                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n✅ Passed:  ${passedTests}`);
  console.log(`❌ Failed:  ${failedTests}`);
  console.log(`📈 Total:   ${totalTests}`);

  if (failedTests === 0) {
    console.log(
      `\n🎉 All tests passed! Integration tests are ready for production.\n`
    );
  } else {
    console.log(
      `\n⚠️  ${failedTests} test suite(s) failed. Check errorIntegration.md for details.\n`
    );
  }
}

/**
 * Write error report to file
 * Hàm này sẽ: ghi `errorIntegration.md` và gọi `generateReport()` để tạo `test-report.html` (HTML)
 */
function writeErrorReport() {
  const reportPath = path.join(__dirname, "errorIntegration.md");
  const timestamp = new Date().toLocaleString();

  let content = `# Integration Test Error Report\n\n`;
  content += `**Generated**: ${timestamp}\n`;
  content += `**Total Errors**: ${errors.length}\n\n`;

  errors.forEach((err, idx) => {
    content += `## Error ${idx + 1}: ${err.suite.toUpperCase()}\n\n`;
    if (err.stdout) {
      content += `### STDOUT\n\n`;
      content += "```\n";
      content += (err.stdout || "").substring(0, 2000);
      content += "\n```\n\n";
    }
    if (err.stderr) {
      content += `### STDERR\n\n`;
      content += "```\n";
      content += (err.stderr || "").substring(0, 2000);
      content += "\n```\n\n";
    }
  });

  content += `---\n\n**Note**: For full logs, check \`test-logs/npm-test.log\`\n`;

  fs.writeFileSync(reportPath, content);
  console.log(`📄 Error report written to: ${reportPath}\n`);

  // Tạo file HTML báo cáo (tổng hợp) để FE/BE có thể xem nhanh trên trình duyệt
  try {
    const gen = generateReport();
    if (gen && gen.ok) {
      console.log(`📄 HTML report generated at: ${gen.path}`);
    } else {
      console.warn("⚠️ Không thể tạo HTML report:", gen && gen.error);
    }
  } catch (e) {
    console.warn(
      "⚠️ Lỗi khi gọi generateReport():",
      e && e.message ? e.message : e
    );
  }
}

// Start tests
runAllTests().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});

// Write a structured test log (compatible with backend/test-reporter.cjs)
function writeStructuredLog() {
  try {
    const logDir = path.join(process.cwd(), "test-logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logPath = path.join(logDir, "npm-test.log");
    const lines = [];
    lines.push(`Integration Test Run - ${new Date().toLocaleString()}`);
    lines.push(`Environment: DB_DRIVER=${process.env.DB_DRIVER || "mysql"}`);
    lines.push(``);

    // Add per-suite summary
    lines.push("Per-suite results:");
    // We have errors array and passed/failed counters; attempt to summarize
    // For suites without explicit stdout captured, we still list pass/fail counts
    // If errors contain suite entries, include their stdout/stderr
    if (passedTests + failedTests === 0) {
      lines.push("  No suites were executed.");
    } else {
      lines.push(`  Total suites executed: ${passedTests + failedTests}`);
      lines.push(`  Passed suites: ${passedTests}`);
      lines.push(`  Failed suites: ${failedTests}`);
    }

    if (errors && errors.length > 0) {
      lines.push("\nDetailed Errors:");
      errors.forEach((e, idx) => {
        lines.push(`\n--- Error ${idx + 1}: ${e.suite}`);
        if (e.stdout) {
          lines.push(`STDOUT:\n${e.stdout.substring(0, 8000)}`);
        }
        if (e.stderr) {
          lines.push(`STDERR:\n${e.stderr.substring(0, 8000)}`);
        }
        if (e.error) {
          lines.push(`ERROR:\n${e.error}`);
        }
      });
    }

    // Append final summary
    lines.push(
      `\nSummary: Passed ${passedTests} | Failed ${failedTests} | Total ${
        passedTests + failedTests
      }`
    );

    fs.writeFileSync(logPath, lines.join("\n\n"), "utf8");
    console.log(`
Wrote integration log to: ${logPath}`);
  } catch (e) {
    console.warn("⚠️ Failed to write structured integration log:", e.message);
  }
}

// Hook to ensure log is written on exit (both normal and error cases)
process.on("exit", () => {
  writeStructuredLog();
});
process.on("SIGINT", () => {
  writeStructuredLog();
  process.exit(1);
});
