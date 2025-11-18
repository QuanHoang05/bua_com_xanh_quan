import "dotenv/config";
import { db } from "./db.js"; // db đã export cho cả MySQL và SQLite

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";

export async function ensureAddressColumn() {
  try {
    if (useMySQL) {
      // MySQL: kiểm tra cột
      const [rows] = await db.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'
           AND COLUMN_NAME = 'address'`
      );

      if (rows.length === 0) {
        await db.query(
          `ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER role`
        );
        console.log("[migrate] users.address added (MySQL)");
      }

    } else {
      // SQLite: PRAGMA
      const cols = db.prepare(`PRAGMA table_info(users)`).all();
      if (!cols.some((c) => c.name === "address")) {
        db.prepare(`ALTER TABLE users ADD COLUMN address TEXT`).run();
        console.log("[migrate] users.address added (SQLite)");
      }
    }
  } catch (e) {
    if (useMySQL && e.code === "ER_DUP_FIELDNAME") return;
    console.warn("[migrate] ensureAddressColumn warning:", e.message);
  }
}
