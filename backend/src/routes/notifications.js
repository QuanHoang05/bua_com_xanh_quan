import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

const r = Router();
async function dbAll(sql, params=[]) { 
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows ?? []; }
  return db.prepare(sql).all(...params);
}

r.get("/", requireAuth, async (req, res) => {
  const items = await dbAll(
    `SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ items });
});

export default r;
