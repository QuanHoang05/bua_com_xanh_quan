#!/usr/bin/env node
/**
 * Integration Test: Admin User Management (Real Database)
 * Tests: List, Details, Update, Make Admin, Ban, Unban, Filter
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
    logTest("ADMIN-SETUP", "App Import", "FAIL", error.message);
    printResults();
    process.exit(1);
  }

  // ADMIN-USR-01: List all users
  try {
    if (!adminToken) throw new Error("No admin token");

    const res = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.status === 200) {
      const count = Array.isArray(res.body)
        ? res.body.length
        : res.body?.users?.length || 0;
      logTest(
        "ADMIN-USR-01",
        "List All Users",
        "PASS",
        `Found: ${count} users`
      );
    } else if (res.status === 401) {
      logTest("ADMIN-USR-01", "List All Users", "SKIP", "Requires admin auth");
    } else {
      logTest(
        "ADMIN-USR-01",
        "List All Users",
        "FAIL",
        `Status: ${res.status}`
      );
    }
  } catch (error) {
    logTest("ADMIN-USR-01", "List All Users", "FAIL", error.message);
  }

  // ADMIN-USR-02: Get user details
  try {
    if (!adminToken) throw new Error("No admin token");

    // First get list to get a user ID
    const listRes = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    const users = Array.isArray(listRes.body)
      ? listRes.body
      : listRes.body?.users || [];

    if (users.length > 0) {
      const userId = users[0].id;
      const res = await http
        .get(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      if (res.status === 200) {
        logTest(
          "ADMIN-USR-02",
          "Get User Details",
          "PASS",
          `User ID: ${userId}`
        );
      } else {
        logTest(
          "ADMIN-USR-02",
          "Get User Details",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } else {
      logTest("ADMIN-USR-02", "Get User Details", "SKIP", "No users found");
    }
  } catch (error) {
    logTest("ADMIN-USR-02", "Get User Details", "FAIL", error.message);
  }

  // ADMIN-USR-03: Update user
  try {
    if (!adminToken) throw new Error("No admin token");

    // Get a user first
    const listRes = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    const users = Array.isArray(listRes.body)
      ? listRes.body
      : listRes.body?.users || [];

    if (users.length > 0) {
      const userId = users[0].id;
      const res = await http
        .put(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ phone: "0987654321", address: "Hồ Chí Minh" });

      if (res.status === 200) {
        logTest("ADMIN-USR-03", "Update User", "PASS", `Status: ${res.status}`);
      } else {
        logTest("ADMIN-USR-03", "Update User", "FAIL", `Status: ${res.status}`);
      }
    } else {
      logTest("ADMIN-USR-03", "Update User", "SKIP", "No users found");
    }
  } catch (error) {
    logTest("ADMIN-USR-03", "Update User", "FAIL", error.message);
  }

  // ADMIN-USR-04: Make user admin
  try {
    if (!adminToken) throw new Error("No admin token");

    // Get a non-admin user
    const listRes = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    const users = Array.isArray(listRes.body)
      ? listRes.body
      : listRes.body?.users || [];
    const nonAdminUser = users.find((u) => u.role !== "admin");

    if (nonAdminUser) {
      const res = await http
        .post(`/api/admin/users/${nonAdminUser.id}/make-admin`)
        .set("Authorization", `Bearer ${adminToken}`);

      if (res.status === 200) {
        logTest(
          "ADMIN-USR-04",
          "Make User Admin",
          "PASS",
          `Status: ${res.status}`
        );
      } else if (res.status === 404) {
        logTest(
          "ADMIN-USR-04",
          "Make User Admin",
          "SKIP",
          "Endpoint not found"
        );
      } else {
        logTest(
          "ADMIN-USR-04",
          "Make User Admin",
          "FAIL",
          `Status: ${res.status}`
        );
      }
    } else {
      logTest(
        "ADMIN-USR-04",
        "Make User Admin",
        "SKIP",
        "No non-admin users found"
      );
    }
  } catch (error) {
    logTest("ADMIN-USR-04", "Make User Admin", "FAIL", error.message);
  }

  // ADMIN-USR-05: Ban user
  try {
    if (!adminToken) throw new Error("No admin token");

    // Get a user
    const listRes = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    const users = Array.isArray(listRes.body)
      ? listRes.body
      : listRes.body?.users || [];

    if (users.length > 0) {
      const userId = users[0].id;
      const res = await http
        .post(`/api/admin/users/${userId}/ban`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Test ban" });

      if (res.status === 200) {
        logTest("ADMIN-USR-05", "Ban User", "PASS", `Status: ${res.status}`);
      } else if (res.status === 404) {
        logTest("ADMIN-USR-05", "Ban User", "SKIP", "Endpoint not found");
      } else {
        logTest("ADMIN-USR-05", "Ban User", "FAIL", `Status: ${res.status}`);
      }
    } else {
      logTest("ADMIN-USR-05", "Ban User", "SKIP", "No users found");
    }
  } catch (error) {
    logTest("ADMIN-USR-05", "Ban User", "FAIL", error.message);
  }

  // ADMIN-USR-06: Unban user
  try {
    if (!adminToken) throw new Error("No admin token");

    // Get a user
    const listRes = await http
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    const users = Array.isArray(listRes.body)
      ? listRes.body
      : listRes.body?.users || [];

    if (users.length > 0) {
      const userId = users[0].id;
      const res = await http
        .post(`/api/admin/users/${userId}/unban`)
        .set("Authorization", `Bearer ${adminToken}`);

      if (res.status === 200) {
        logTest("ADMIN-USR-06", "Unban User", "PASS", `Status: ${res.status}`);
      } else if (res.status === 404) {
        logTest("ADMIN-USR-06", "Unban User", "SKIP", "Endpoint not found");
      } else {
        logTest("ADMIN-USR-06", "Unban User", "FAIL", `Status: ${res.status}`);
      }
    } else {
      logTest("ADMIN-USR-06", "Unban User", "SKIP", "No users found");
    }
  } catch (error) {
    logTest("ADMIN-USR-06", "Unban User", "FAIL", error.message);
  }

  // ADMIN-USR-07: Filter users
  try {
    if (!adminToken) throw new Error("No admin token");

    const res = await http
      .get("/api/admin/users?role=user")
      .set("Authorization", `Bearer ${adminToken}`);

    if (res.status === 200) {
      logTest("ADMIN-USR-07", "Filter Users", "PASS", `Status: ${res.status}`);
    } else {
      logTest("ADMIN-USR-07", "Filter Users", "FAIL", `Status: ${res.status}`);
    }
  } catch (error) {
    logTest("ADMIN-USR-07", "Filter Users", "FAIL", error.message);
  }

  printResults();
  process.exit(results.failed > 0 ? 1 : 0);
}

function printResults() {
  console.log("\n" + "═".repeat(64));
  console.log("📊 ADMIN USERS TESTS SUMMARY");
  console.log("═".repeat(64));
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log("═".repeat(64) + "\n");
}

runTests();
