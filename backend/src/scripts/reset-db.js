// src/scripts/reset-db.js
import { db } from "../lib/db.js";
import { executeSqlFile } from "../lib/db.js";
import path from "path";
import { fileURLToPath } from "url";

console.log("Starting test database reset...");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPath = path.resolve(
  __dirname,
  "..",
  "..",
  "testAPIreal",
  "seed_db.sql"
);

executeSqlFile(db.getPool(), seedPath)
  .then(() => {
    console.log("Database reset completed successfully.");
    // Không cần đóng kết nối ở đây, vì process test chính sẽ quản lý
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to reset database:", error);
    process.exit(1);
  });
