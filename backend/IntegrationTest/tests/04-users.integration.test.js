#!/usr/bin/env node
/**
 * Integration Test: User Features (Real Database)
 * Tests: Profile, Update, Delivery History, Donations, Activity, Settings
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
  let userToken;
  let userId;

  try {
    console.log("\n📥 Importing app with real database...");
    const appModule = await import("../../src/app.js");
    const app = appModule.default;
    http = request(app);
    console.log("✅ App imported - Connected to real MySQL database\n");

    // Try to get user token
    try {
      const loginRes = await http
        .post("/api/auth/login")
        .send({ email: "donor@bua.com", password: "donor123" });

      if (loginRes.body?.token && loginRes.body?.user?.id) {
        userToken = loginRes.body.token;
        userId = loginRes.body.user.id;
        console.log("✅ User token obtained\n");
      }
    } catch (err) {
      console.log(
        "⚠️  Could not obtain user token - Some tests will be skipped\n"
      );
    }
  } catch (error) {
    logTest("USERS-SETUP", "App Import", "FAIL", error.message);
    printResults();
    process.exit(1);
  }

  // USER-INT-01: Get user profile
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${userToken}`);

    if (res.status === 200) {
      logTest(
        "USER-INT-01",
        "Get User Profile",
        "PASS",
        `User: ${res.body.email}`
      );
    } else if (res.status === 401) {
      logTest("USER-INT-01", "Get User Profile", "SKIP", "Requires user auth");
    } else {
      logTest(
        "USER-INT-01",
        "Get User Profile",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-01", "Get User Profile", "FAIL", error.message);
  }

  // USER-INT-02: Update user profile
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ phone: "0912345678", address: "Hà Nội" });

    if (res.status === 200) {
      logTest(
        "USER-INT-02",
        "Update User Profile",
        "PASS",
        `Status: ${res.status}`
      );
    } else if (res.status === 401) {
      logTest(
        "USER-INT-02",
        "Update User Profile",
        "SKIP",
        "Requires user auth"
      );
    } else {
      logTest(
        "USER-INT-02",
        "Update User Profile",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-02", "Update User Profile", "FAIL", error.message);
  }

  // USER-INT-03: Get delivery history
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .get("/api/users/deliveries")
      .set("Authorization", `Bearer ${userToken}`);

    if (res.status === 200) {
      const count = Array.isArray(res.body)
        ? res.body.length
        : res.body?.deliveries?.length || 0;
      logTest(
        "USER-INT-03",
        "Get Delivery History",
        "PASS",
        `Found: ${count} deliveries`
      );
    } else if (res.status === 401) {
      logTest(
        "USER-INT-03",
        "Get Delivery History",
        "SKIP",
        "Requires user auth"
      );
    } else {
      logTest(
        "USER-INT-03",
        "Get Delivery History",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-03", "Get Delivery History", "FAIL", error.message);
  }

  // USER-INT-04: Get donations history
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .get("/api/users/donations")
      .set("Authorization", `Bearer ${userToken}`);

    if (res.status === 200) {
      const count = Array.isArray(res.body)
        ? res.body.length
        : res.body?.donations?.length || 0;
      logTest(
        "USER-INT-04",
        "Get Donations History",
        "PASS",
        `Found: ${count} donations`
      );
    } else if (res.status === 401) {
      logTest(
        "USER-INT-04",
        "Get Donations History",
        "SKIP",
        "Requires user auth"
      );
    } else {
      logTest(
        "USER-INT-04",
        "Get Donations History",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-04", "Get Donations History", "FAIL", error.message);
  }

  // USER-INT-05: Get user activity
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .get("/api/users/activity")
      .set("Authorization", `Bearer ${userToken}`);

    if (res.status === 200) {
      const count = Array.isArray(res.body)
        ? res.body.length
        : res.body?.activities?.length || 0;
      logTest(
        "USER-INT-05",
        "Get User Activity",
        "PASS",
        `Found: ${count} activities`
      );
    } else if (res.status === 401) {
      logTest("USER-INT-05", "Get User Activity", "SKIP", "Requires user auth");
    } else {
      logTest(
        "USER-INT-05",
        "Get User Activity",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-05", "Get User Activity", "FAIL", error.message);
  }

  // USER-INT-06: Update user settings
  try {
    if (!userToken) throw new Error("No user token");

    const res = await http
      .put("/api/users/settings")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ notifications: true, newsletter: false, marketing_emails: true });

    if (res.status === 200) {
      logTest(
        "USER-INT-06",
        "Update User Settings",
        "PASS",
        `Status: ${res.status}`
      );
    } else if (res.status === 401) {
      logTest(
        "USER-INT-06",
        "Update User Settings",
        "SKIP",
        "Requires user auth"
      );
    } else {
      logTest(
        "USER-INT-06",
        "Update User Settings",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("USER-INT-06", "Update User Settings", "FAIL", error.message);
  }

  printResults();
  process.exit(results.failed > 0 ? 1 : 0);
}

function printResults() {
  console.log("\n" + "═".repeat(64));
  console.log("📊 USERS TESTS SUMMARY");
  console.log("═".repeat(64));
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log("═".repeat(64) + "\n");
}

runTests();
