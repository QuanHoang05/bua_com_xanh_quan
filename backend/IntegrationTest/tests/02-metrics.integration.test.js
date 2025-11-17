#!/usr/bin/env node
/**
 * Integration Test: Admin Metrics (Real Database)
 * Tests: Delivery Stats, Heatmap, Donor Stats, Campaign Stats, Overview
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
  let adminToken;

  try {
    console.log("\n📥 Importing app with real database...");
    const appModule = await import("../../src/app.js");
    const app = appModule.default;
    http = request(app);
    console.log("✅ App imported - Connected to real MySQL database\n");

    // Try to get admin token
    try {
      const loginRes = await http
        .post("/api/auth/login")
        .send({ email: "admin@bua.com", password: "admin123" });

      if (loginRes.body?.token) {
        adminToken = loginRes.body.token;
        console.log("✅ Admin token obtained\n");
      }
    } catch (err) {
      console.log(
        "⚠️  Could not obtain admin token - Some tests will be skipped\n"
      );
    }
  } catch (error) {
    logTest("METRICS-SETUP", "App Import", "FAIL", error.message);
    printResults();
    process.exit(1);
  }

  // ADMN-MTR-01: Delivery Success Stats
  try {
    const res = await http
      .get("/api/admin/metrics/delivery-success")
      .set("Authorization", adminToken ? `Bearer ${adminToken}` : "");

    if (
      res.status === 200 &&
      (res.body.delivered !== undefined || res.body.total !== undefined)
    ) {
      logTest(
        "ADMN-MTR-01",
        "Delivery Success Stats",
        "PASS",
        `Delivered: ${res.body.delivered}, Total: ${res.body.total}`
      );
    } else if (res.status === 401) {
      logTest(
        "ADMN-MTR-01",
        "Delivery Success Stats",
        "SKIP",
        "Requires admin auth"
      );
    } else {
      logTest(
        "ADMN-MTR-01",
        "Delivery Success Stats",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("ADMN-MTR-01", "Delivery Success Stats", "FAIL", error.message);
  }

  // ADMN-MTR-02: Heatmap Data
  try {
    const res = await http
      .get("/api/admin/metrics/heatmap")
      .set("Authorization", adminToken ? `Bearer ${adminToken}` : "");

    if (res.status === 200 && res.body.cells !== undefined) {
      logTest(
        "ADMN-MTR-02",
        "Heatmap Data",
        "PASS",
        `Cells: ${
          Array.isArray(res.body.cells) ? res.body.cells.length : "N/A"
        }`
      );
    } else if (res.status === 401) {
      logTest("ADMN-MTR-02", "Heatmap Data", "SKIP", "Requires admin auth");
    } else {
      logTest("ADMN-MTR-02", "Heatmap Data", "FAIL", `Status: ${res.status}`);
    }
  } catch (error) {
    logTest("ADMN-MTR-02", "Heatmap Data", "FAIL", error.message);
  }

  // ADMN-MTR-03: Donor Statistics
  try {
    const res = await http
      .get("/api/admin/metrics/donors")
      .set("Authorization", adminToken ? `Bearer ${adminToken}` : "");

    if (res.status === 200) {
      logTest(
        "ADMN-MTR-03",
        "Donor Statistics",
        "PASS",
        `Status: ${res.status}`
      );
    } else if (res.status === 401) {
      logTest("ADMN-MTR-03", "Donor Statistics", "SKIP", "Requires admin auth");
    } else {
      logTest(
        "ADMN-MTR-03",
        "Donor Statistics",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("ADMN-MTR-03", "Donor Statistics", "FAIL", error.message);
  }

  // ADMN-MTR-04: Campaign Statistics
  try {
    const res = await http
      .get("/api/admin/metrics/campaigns")
      .set("Authorization", adminToken ? `Bearer ${adminToken}` : "");

    if (res.status === 200) {
      logTest(
        "ADMN-MTR-04",
        "Campaign Statistics",
        "PASS",
        `Status: ${res.status}`
      );
    } else if (res.status === 401) {
      logTest(
        "ADMN-MTR-04",
        "Campaign Statistics",
        "SKIP",
        "Requires admin auth"
      );
    } else {
      logTest(
        "ADMN-MTR-04",
        "Campaign Statistics",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("ADMN-MTR-04", "Campaign Statistics", "FAIL", error.message);
  }

  // ADMN-MTR-05: Overview Metrics
  try {
    const res = await http
      .get("/api/admin/metrics/overview")
      .set("Authorization", adminToken ? `Bearer ${adminToken}` : "");

    if (res.status === 200) {
      logTest(
        "ADMN-MTR-05",
        "Overview Metrics",
        "PASS",
        `Status: ${res.status}`
      );
    } else if (res.status === 401) {
      logTest("ADMN-MTR-05", "Overview Metrics", "SKIP", "Requires admin auth");
    } else {
      logTest(
        "ADMN-MTR-05",
        "Overview Metrics",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("ADMN-MTR-05", "Overview Metrics", "FAIL", error.message);
  }

  printResults();
  process.exit(results.failed > 0 ? 1 : 0);
}

function printResults() {
  console.log("\n" + "═".repeat(64));
  console.log("📊 METRICS TESTS SUMMARY");
  console.log("═".repeat(64));
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log("═".repeat(64) + "\n");
}

runTests();
