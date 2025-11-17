import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

// Read DB connection from env
const host = process.env.DB_HOST || "127.0.0.1";
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "";
const database = process.env.DB_DATABASE || "bua_com_xanh";

async function run() {
  const sqlPath = path.resolve(process.cwd(), "seed_db.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("seed_db.sql not found at", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log(
    "[SEED-MYSQL] Connecting to MySQL",
    `${user}@${host}:${port}/${database}`
  );
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });
  try {
    // Execute the SQL script (may contain multiple statements)
    await conn.query(sql);
    console.log("[SEED-MYSQL] Seed executed successfully");

    // Ensure admin and donor seeded (hash passwords)
    const adminEmail = "admin@bua.com";
    const adminPwd = "admin123";
    const donorEmail = "donor@bua.com";
    const donorPwd = "donor123";

    const [rows] = await conn.query(
      "SELECT email FROM users WHERE email IN (?,?)",
      [adminEmail, donorEmail]
    );
    const existing = (rows || []).map((r) => r.email);
    if (!existing.includes(adminEmail)) {
      const hash = await bcrypt.hash(adminPwd, 10);
      const id = randomUUID();
      await conn.query(
        "INSERT INTO users (id,email,password_hash,name,role,status,created_at) VALUES (?,?,?,?,?,? , NOW())",
        [id, adminEmail, hash, "Admin Seed", "admin", "active"]
      );
      console.log("[SEED-MYSQL] Inserted admin:", adminEmail);
    }
    if (!existing.includes(donorEmail)) {
      const hash2 = await bcrypt.hash(donorPwd, 10);
      const id2 = randomUUID();
      await conn.query(
        "INSERT INTO users (id,email,password_hash,name,role,status,created_at) VALUES (?,?,?,?,?,? , NOW())",
        [id2, donorEmail, hash2, "Donor Seed", "donor", "active"]
      );
      console.log("[SEED-MYSQL] Inserted donor:", donorEmail);
    }

    // Ensure at least one campaign exists for integration tests
    const [campCountRows] = await conn.query(
      "SELECT COUNT(*) AS c FROM campaigns"
    );
    const campCount = campCountRows?.[0]?.c || 0;
    if (campCount === 0) {
      console.log(
        "[SEED-MYSQL] No campaigns found — inserting sample campaign"
      );
      const sampleMeta = JSON.stringify({
        type: "meal",
        payment: { method: "momo" },
        meal: { unit: "phần", target_qty: 100, price: 10000 },
      });
      // Insert campaign with CHAR(36) id (UUID) to match ensure-mysql schema
      const campaignId = randomUUID();
      const tagsJson = JSON.stringify([]);
      await conn.query(
        `INSERT INTO campaigns (id, title, description, location, type, tags, meta, cover_url, status, target_amount, raised_amount, meal_price, meal_received_qty, delivered_meals, created_at)
         VALUES (?, ?, ?, ?, 'meal', ?, ?, ?, 'active', 0, 0, ?, 0, 0, NOW())`,
        [
          campaignId,
          "Integration Seed Campaign",
          "Mô tả chiến dịch mẫu (seed)",
          "Hội An",
          tagsJson,
          sampleMeta,
          "",
          10000,
        ]
      );
      console.log(`[SEED-MYSQL] Inserted campaign id=${campaignId}`);

      // Insert a successful donation so campaign shows up with raised/supporters
      await conn.query(
        `INSERT INTO donations (order_id, campaign_id, user_id, type, amount, qty, currency, donor_name, donor_note, memo, status, created_at, paid_at)
         VALUES ('', ?, NULL, 'money', ?, 0, 'VND', ?, ?, '', 'success', NOW(), NOW())`,
        [campaignId, 100000, "Seed Donor", "Seed donation"]
      );
      console.log(
        `[SEED-MYSQL] Inserted donation for campaign id=${campaignId}`
      );
    } else {
      console.log(
        `[SEED-MYSQL] Campaigns present (${campCount}), skipping sample insert`
      );
    }

    process.exit(0);
  } catch (err) {
    console.error(
      "[SEED-MYSQL] Error executing seed:",
      err && err.message ? err.message : err
    );
    process.exit(2);
  } finally {
    try {
      await conn.end();
    } catch {}
  }
}

run().catch((e) => {
  console.error("[SEED-MYSQL] Fatal error:", e && e.message ? e.message : e);
  process.exit(2);
});
