import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Open an in-memory DB for tests, otherwise a file under data/
const isTest = process.env.NODE_ENV === "test";
const dbFile = isTest
  ? ":memory:"
  : path.resolve(process.cwd(), "backend", "data", "db.sqlite");

// Ensure data dir exists when using file-backed DB
if (!isTest) {
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const dbInstance = new Database(dbFile);

// Export a compatible db object (better-sqlite3 Database instance)
export const db = dbInstance;

// migrate: placeholder. The project provides seed scripts if needed.
export const migrate = async () => {
  // No-op here; tests or seed scripts can run SQL via seed_full.js if required.
  return;
};

export default { db, migrate };
