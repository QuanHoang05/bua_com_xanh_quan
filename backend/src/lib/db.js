﻿import "dotenv/config";

let realDb = null;
export let migrate = async () => {};

/**
 * A proxy object that safely wraps the real DB connection.
 * It will throw an error if the DB is accessed before `initDb()` is called.
 */
export const db = new Proxy(
  {},
  {
    get(_, prop) {
      if (!realDb) {
        throw new Error(
          "[db.js] DB not initialized. Call initDb() before accessing the database."
        );
      }
      // Return the property or method from the actual database object
      const target = realDb[prop];
      return typeof target === "function" ? target.bind(realDb) : target;
    },
  }
);

/**
 * Initializes the database connection based on the DB_DRIVER environment variable.
 * This function MUST be called once at the start of the application or test suite.
 */
export async function initDb() {
  // Prevent re-initialization
  if (realDb) return realDb;

  const driver = (process.env.DB_DRIVER || "sqlite").toLowerCase();

  if (driver === "mysql") {
    const mysqlModule = await import("./db.mysql.js");
    realDb = mysqlModule.db;
    migrate = mysqlModule.migrate;
    console.log("🗄️  Initialized MySQL driver.");
  } else {
    const sqliteModule = await import("./db.sqlite.js");
    realDb = sqliteModule.db;
    migrate = sqliteModule.migrate;
    console.log("🗄️  Initialized SQLite driver.");
  }

  // Return the actual DB instance so it can be managed (e.g., closed) by the caller.
  return realDb;
}
