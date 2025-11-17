#!/usr/bin/env node
/**
 * Integration Test: Campaigns (Real Database)
 * Tests: List, Details, Filter, Search, Sort, Donate
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

      if (loginRes.body?.token) {
        userToken = loginRes.body.token;
        console.log("✅ User token obtained\n");
      }
    } catch (err) {
      console.log(
        "⚠️  Could not obtain user token - Some tests will be skipped\n"
      );
    }
  } catch (error) {
    logTest("CAMPAIGNS-SETUP", "App Import", "FAIL", error.message);
    printResults();
    process.exit(1);
  }

  // CAMP-INT-01: List all campaigns
  try {
    const res = await http.get("/api/campaigns");

    if (res.status === 200 && Array.isArray(res.body)) {
      logTest(
        "CAMP-INT-01",
        "List All Campaigns",
        "PASS",
        `Found: ${res.body.length} campaigns`
      );
    } else if (res.status === 200 && Array.isArray(res.body.items)) {
      logTest(
        "CAMP-INT-01",
        "List All Campaigns",
        "PASS",
        `Found: ${res.body.items.length} campaigns`
      );
    } else if (res.status === 200 && res.body && typeof res.body === "object") {
      const count = Array.isArray(res.body.items)
        ? res.body.items.length
        : res.body.total || 0;
      logTest(
        "CAMP-INT-01",
        "List All Campaigns",
        "PASS",
        `Found: ${count} campaigns`
      );
    } else {
      logTest(
        "CAMP-INT-01",
        "List All Campaigns",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("CAMP-INT-01", "List All Campaigns", "FAIL", error.message);
  }

  // CAMP-INT-02: Get campaign details
  try {
    // First, get a campaign ID
    const listRes = await http.get("/api/campaigns");
    const campaigns = Array.isArray(listRes.body)
      ? listRes.body
      : Array.isArray(listRes.body?.items)
      ? listRes.body.items
      : [];

    if (campaigns.length > 0) {
      const campaignId = campaigns[0].id;
      const res = await http.get(`/api/campaigns/${campaignId}`);

      if (res.status === 200) {
        logTest(
          "CAMP-INT-02",
          "Get Campaign Details",
          "PASS",
          `Campaign ID: ${campaignId}`
        );
      } else {
        logTest(
          "CAMP-INT-02",
          "Get Campaign Details",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } else {
      logTest(
        "CAMP-INT-02",
        "Get Campaign Details",
        "SKIP",
        "No campaigns found"
      );
    }
  } catch (error) {
    logTest("CAMP-INT-02", "Get Campaign Details", "FAIL", error.message);
  }

  // CAMP-INT-03: Filter campaigns by status
  try {
    const res = await http.get("/api/campaigns?status=active");

    if (res.status === 200) {
      logTest(
        "CAMP-INT-03",
        "Filter by Status",
        "PASS",
        `Status: ${res.status}`
      );
    } else {
      logTest(
        "CAMP-INT-03",
        "Filter by Status",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("CAMP-INT-03", "Filter by Status", "FAIL", error.message);
  }

  // CAMP-INT-04: Search campaigns
  try {
    const res = await http.get("/api/campaigns?search=food");

    if (res.status === 200) {
      logTest(
        "CAMP-INT-04",
        "Search Campaigns",
        "PASS",
        `Status: ${res.status}`
      );
    } else {
      logTest(
        "CAMP-INT-04",
        "Search Campaigns",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("CAMP-INT-04", "Search Campaigns", "FAIL", error.message);
  }

  // CAMP-INT-05: Sort campaigns
  try {
    const res = await http.get("/api/campaigns?sort=created_at&order=desc");

    if (res.status === 200) {
      logTest("CAMP-INT-05", "Sort Campaigns", "PASS", `Status: ${res.status}`);
    } else {
      logTest("CAMP-INT-05", "Sort Campaigns", "FAIL", `Status: ${res.status}`);
    }
  } catch (error) {
    logTest("CAMP-INT-05", "Sort Campaigns", "FAIL", error.message);
  }

  // CAMP-INT-06: Donate to campaign
  try {
    // First, get a campaign ID
    const listRes = await http.get("/api/campaigns");
    const campaigns = Array.isArray(listRes.body)
      ? listRes.body
      : Array.isArray(listRes.body?.items)
      ? listRes.body.items
      : [];

    if (campaigns.length > 0 && userToken) {
      const campaignId = campaigns[0].id;
      // Use correct endpoint: POST /api/campaigns/:id/donations
      const res = await http
        .post(`/api/campaigns/${campaignId}/donations`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 100000 });

      if (res.status === 200 || res.status === 201) {
        // API returns { ok:true, kind, next_action }
        if (res.body && res.body.ok) {
          logTest(
            "CAMP-INT-06",
            "Donate to Campaign",
            "PASS",
            `Status: ${res.status}`
          );
        } else {
          logTest(
            "CAMP-INT-06",
            "Donate to Campaign",
            "FAIL",
            `Unexpected body: ${JSON.stringify(res.body).slice(0, 200)}`
          );
        }
      } else if (res.status === 401) {
        logTest(
          "CAMP-INT-06",
          "Donate to Campaign",
          "SKIP",
          "Requires user auth"
        );
      } else {
        logTest(
          "CAMP-INT-06",
          "Donate to Campaign",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } else {
      logTest(
        "CAMP-INT-06",
        "Donate to Campaign",
        "SKIP",
        "No campaigns found or no user token"
      );
    }
  } catch (error) {
    logTest("CAMP-INT-06", "Donate to Campaign", "FAIL", error.message);
  }

  // CAMP-INT-07: GET /api/campaigns/stats
  try {
    const res = await http.get("/api/campaigns/stats");
    if (res.status === 200 && res.body && res.body.ok) {
      logTest(
        "CAMP-INT-07",
        "Campaigns Stats",
        "PASS",
        `campaigns=${res.body.campaigns} raised=${res.body.raised}`
      );
    } else {
      logTest(
        "CAMP-INT-07",
        "Campaigns Stats",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("CAMP-INT-07", "Campaigns Stats", "FAIL", error.message);
  }

  // CAMP-INT-08: GET /api/campaigns/:id/donations
  try {
    const listRes2 = await http.get("/api/campaigns");
    const campaigns2 = Array.isArray(listRes2.body)
      ? listRes2.body
      : Array.isArray(listRes2.body?.items)
      ? listRes2.body.items
      : [];
    if (campaigns2.length > 0) {
      const campaignId = campaigns2[0].id;
      const res = await http.get(`/api/campaigns/${campaignId}/donations`);
      if (res.status === 200 && Array.isArray(res.body?.items)) {
        logTest(
          "CAMP-INT-08",
          "Campaign Donations List",
          "PASS",
          `Found: ${res.body.items.length}`
        );
      } else {
        logTest(
          "CAMP-INT-08",
          "Campaign Donations List",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } else {
      logTest(
        "CAMP-INT-08",
        "Campaign Donations List",
        "SKIP",
        "No campaigns found"
      );
    }
  } catch (error) {
    logTest("CAMP-INT-08", "Campaign Donations List", "FAIL", error.message);
  }

  printResults();
  process.exit(results.failed > 0 ? 1 : 0);
}

function printResults() {
  console.log("\n" + "═".repeat(64));
  console.log("📊 CAMPAIGNS TESTS SUMMARY");
  console.log("═".repeat(64));
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log("═".repeat(64) + "\n");
}

runTests();
