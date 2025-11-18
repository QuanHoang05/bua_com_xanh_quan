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

/**
 * Runs migrations to create the necessary tables for the SQLite database.
 * This is essential for the test environment.
 */
export const migrate = async () => {
  console.log("[MIGRATE-SQLITE] Running migrations...");
  try {
    // Use a transaction for efficiency and safety
    db.exec(`
      BEGIN;

      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        campaign_id INTEGER,
        user_id CHAR(36),
        status TEXT,
        qty INTEGER,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        avatar_url VARCHAR(500),
        role TEXT CHECK(role IN ('user','donor','receiver','shipper','admin')) NOT NULL DEFAULT 'user',
        address VARCHAR(255),
        lat REAL,
        lng REAL,
        status TEXT CHECK(status IN ('active','banned','deleted')) NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        type TEXT,
        cover_url VARCHAR(500),
        tags TEXT,
        meta TEXT,
        target_amount INTEGER NOT NULL DEFAULT 0,
        raised_amount INTEGER NOT NULL DEFAULT 0,
        supporters INTEGER NOT NULL DEFAULT 0,
        meal_price INTEGER,
        meal_received_qty INTEGER,
        delivered_meals INTEGER,
        status TEXT CHECK(status IN ('active','closed')) NOT NULL DEFAULT 'active',
        deadline TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS food_items (
        id CHAR(36) PRIMARY KEY,
        owner_id CHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        qty INTEGER NOT NULL DEFAULT 0,
        unit VARCHAR(20),
        expire_at TEXT,
        location_addr VARCHAR(255),
        lat REAL,
        lng REAL,
        tags TEXT,
        images TEXT,
        status TEXT CHECK(status IN ('available','reserved','done','cancelled')) NOT NULL DEFAULT 'available',
        visibility TEXT CHECK(visibility IN ('public','private')) NOT NULL DEFAULT 'public',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pickup_points (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255),
        lat REAL,
        lng REAL,
        opening TEXT,
        status TEXT CHECK(status IN ('active','inactive')) NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id VARCHAR(100),
        campaign_id INTEGER,
        user_id CHAR(36),
        type TEXT,
        amount INTEGER NOT NULL DEFAULT 0,
        qty INTEGER NOT NULL DEFAULT 0,
        currency VARCHAR(10),
        donor_name VARCHAR(255),
        donor_note TEXT,
        memo TEXT,
        status TEXT CHECK(status IN ('pending','success','failed','pledged','scheduled')) NOT NULL DEFAULT 'pending',
        paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS metrics_daily (
        day TEXT PRIMARY KEY,
        items INTEGER NOT NULL DEFAULT 0,
        bookings INTEGER NOT NULL DEFAULT 0,
        deliveries INTEGER NOT NULL DEFAULT 0,
        rescued_meals INTEGER NOT NULL DEFAULT 0,
        fee_revenue INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tags (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      COMMIT;
    `);
    console.log("[MIGRATE-SQLITE] Tables created successfully.");
  } catch (err) {
    console.error("[MIGRATE-SQLITE] Migration failed:", err);
    db.exec("ROLLBACK;");
    throw err;
  }
};

export default { db, migrate };
