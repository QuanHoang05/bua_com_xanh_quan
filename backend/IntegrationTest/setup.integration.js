// IntegrationTest/setup.integration.js
import { beforeAll, beforeEach, afterAll } from "@jest/globals";
import { initDb, migrate } from "../src/lib/db.js";

let app;
let seeder;
let db;

/**
 * beforeAll: Runs ONCE before all tests in the suite.
 *
 * 1. Explicitly initialize the database connection.
 * 2. Run migrations to ensure the schema is created.
 * 3. Dynamically import the Express app AFTER the DB is ready.
 * 4. Import the seeder module.
 */
beforeAll(async () => {
  // Step 1: Initialize DB connection and get the instance.
  db = await initDb();

  // Step 2: Run migrations ONCE to create the schema
  await migrate();

  // Step 3: Import the app AFTER DB is ready
  const mod = await import("../src/app.js");
  app = mod.default;

  // Step 4: Import the seeder. Assuming you have a seeder file that uses Knex.
  // Make sure this path is correct.
  seeder = (await import("../src/seed_full.js")).default;
});

/**
 * beforeEach: Runs before EACH test case.
 * Its job is to re-seed the database, ensuring every test starts
 * with a clean, consistent state. This prevents tests from interfering with each other.
 */
beforeEach(async () => {
  // Clean the DB and then re-seed it for a pristine state
  await seeder.clean();
  await seeder.seed();
});

/**
 * afterAll: Runs ONCE after all tests in the suite have completed.
 * Its job is to close the database connection to prevent hanging processes.
 */
afterAll(async () => {
  // Use the 'db' instance we captured in beforeAll.
  if (db && typeof db.destroy === 'function') {
    await db.destroy(); // For Knex (MySQL)
  } else if (db && typeof db.close === 'function') {
    db.close(); // For better-sqlite3
  }
});

/**
 * Helper function to get the initialized app instance.
 * Tests will call this to ensure they get the app *after* it's ready.
 */
export function getApp() {
  if (!app) {
    throw new Error("App not initialized. Ensure setup.integration.js has run its beforeAll hook.");
  }
  return app;
}