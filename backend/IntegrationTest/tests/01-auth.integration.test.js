#!/usr/bin/env node
/**
 * Integration Test: Authentication (Real Database)
 * Tests: Register, Login, Get Profile, Change Password
 * Data: Real MySQL database - bua_com_xanh
 */

import request from "supertest";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment setup for real database
process.env.NODE_ENV = "test";
process.env.DB_DRIVER = "mysql";
process.env.DB_DATABASE = "bua_com_xanh";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "3306";
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "";
process.env.JWT_SECRET = "test-secret";

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Helper to log test results
 */
function logTest(id, name, status, details = "") {
  results.total++;
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} ${id}: ${name} - ${status}`);
  if (details) {
    console.log(`   └─ ${details}`);
  }
  results.tests.push({ id, name, status, details });
  if (status === "PASS") results.passed++;
  else results.failed++;
}

async function runTests() {
  let http;
  let testToken;
  let testUserId;

  try {
    // Import app with real database
    console.log("\n📥 Importing app with real database...");
    const appModule = await import("../../src/app.js");
    const app = appModule.default;
    http = request(app);
    console.log("✅ App imported - Connected to real MySQL database\n");
  } catch (error) {
    logTest("AUTH-SETUP", "App Import", "FAIL", error.message);
    printResults();
    process.exit(1);
  }

  const testUser = {
    name: "Integration Test Auth",
    email: `auth.test.${Date.now()}@example.com`,
    password: "TestPass123!@",
    address: "Test Address, Hanoi",
  };

  // AUTH-INT-01: Register
  try {
    const res = await http.post("/api/auth/register").send(testUser);
    if (res.status === 201 && res.body.token) {
      testToken = res.body.token;
      testUserId = res.body.user?.id;
      logTest("AUTH-INT-01", "Register User", "PASS", `Status: ${res.status}`);
    } else {
      logTest(
        "AUTH-INT-01",
        "Register User",
        "FAIL",
        `Status: ${res.status} (expected 201)`
      );
    }
  } catch (error) {
    logTest("AUTH-INT-01", "Register User", "FAIL", error.message);
  }

  // AUTH-INT-02: Login
  try {
    const res = await http
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });
    if (res.status === 200 && res.body.token) {
      testToken = res.body.token;
      logTest("AUTH-INT-02", "Login", "PASS", `Status: ${res.status}`);
    } else {
      logTest(
        "AUTH-INT-02",
        "Login",
        "FAIL",
        `Status: ${res.status} (expected 200)`
      );
    }
  } catch (error) {
    logTest("AUTH-INT-02", "Login", "FAIL", error.message);
  }

  // AUTH-INT-03: Get Profile
  if (testToken) {
    try {
      const res = await http
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${testToken}`);
      if (res.status === 200 && res.body.user) {
        logTest(
          "AUTH-INT-03",
          "Get Profile",
          "PASS",
          `Email: ${res.body.user.email}`
        );
      } else {
        logTest("AUTH-INT-03", "Get Profile", "FAIL", `Status: ${res.status}`);
      }
    } catch (error) {
      logTest("AUTH-INT-03", "Get Profile", "FAIL", error.message);
    }
  }

  // AUTH-INT-04: Change Password
  if (testToken) {
    try {
      const newPassword = "NewTestPass456!@";
      const res = await http
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ new_password: newPassword });

      if ([200, 201].includes(res.status)) {
        testUser.password = newPassword;
        logTest(
          "AUTH-INT-04",
          "Change Password",
          "PASS",
          `Status: ${res.status}`
        );
      } else {
        logTest(
          "AUTH-INT-04",
          "Change Password",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } catch (error) {
      logTest("AUTH-INT-04", "Change Password", "FAIL", error.message);
    }
  }

  // AUTH-INT-05: Login with New Password
  try {
    const res = await http
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    if (res.status === 200 && res.body.token) {
      logTest(
        "AUTH-INT-05",
        "Login with New Password",
        "PASS",
        `Status: ${res.status}`
      );
    } else {
      logTest(
        "AUTH-INT-05",
        "Login with New Password",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("AUTH-INT-05", "Login with New Password", "FAIL", error.message);
  }

  printResults();
  process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * Print test results
 */
function printResults() {
  console.log("\n" + "═".repeat(64));
  console.log("📊 AUTH TESTS SUMMARY");
  console.log("═".repeat(64));
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log("═".repeat(64) + "\n");
}

runTests();
