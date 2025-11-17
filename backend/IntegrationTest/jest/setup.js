/**
 * IntegrationTest Jest setup helper
 * - Thực hiện seed DB (nếu có) trước khi chạy suites
 * - Kiểm tra kết nối MySQL và ném lỗi rõ ràng nếu DB không sẵn sàng
 * - Comment tiếng Việt để dễ theo dõi
 */

import { spawnSync } from "child_process";
import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";

let seeded = false;

export async function ensureSeededAndConnected() {
  // Nếu đã seed trong cùng một process, bỏ qua
  if (seeded) return;

  const workDir = process.cwd();
  const backendRoot = path.resolve(workDir);

  // Nếu biến SKIP_SEED được bật, skip seed
  if (process.env.SKIP_SEED === "1") {
    console.log("[setup] SKIP_SEED=1 - bỏ qua bước seed DB");
  } else {
    // Nếu tồn tại script seed_mysql.js, chạy nó
    const seedPath = path.join(backendRoot, "src", "seed_mysql.js");
    if (fs.existsSync(seedPath)) {
      try {
        console.log(`[setup] Chạy seed script: ${seedPath}`);
        const res = spawnSync("node", [seedPath], {
          cwd: backendRoot,
          stdio: "inherit",
          env: { ...process.env },
          timeout: 120000,
        });
        if (res.error) {
          console.warn("[setup] Lỗi khi chạy seed:", res.error.message);
        } else if (res.status !== 0) {
          console.warn("[setup] Seed script trả về mã khác 0:", res.status);
        } else {
          console.log("[setup] Seed script hoàn tất");
        }
      } catch (e) {
        console.warn("[setup] Exception khi chạy seed:", e.message);
      }
    } else {
      console.log("[setup] Không tìm thấy seed_mysql.js — bỏ qua seed");
    }
  }

  // Kiểm tra kết nối DB (chỉ khi DB_DRIVER=mysql)
  const driver = (process.env.DB_DRIVER || "mysql").toLowerCase();
  if (driver === "mysql") {
    const host = process.env.DB_HOST || "127.0.0.1";
    const port = parseInt(process.env.DB_PORT || "3306", 10);
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "";
    const database =
      process.env.DB_NAME || process.env.DB_DATABASE || "test_db";

    console.log(
      `[setup] Kiểm tra MySQL: ${user}@${host}:${port} db=${database}`
    );
    try {
      const conn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        connectTimeout: 10000,
      });
      await conn.query("SELECT 1");
      await conn.end();
      console.log("[setup] Kết nối MySQL thành công");
    } catch (err) {
      console.error(
        "[setup] Không thể kết nối MySQL. Hãy đảm bảo MySQL đang chạy và biến môi trường DB_* đã cấu hình. Error:",
        err && err.message ? err.message : err
      );
      throw err;
    }
  } else {
    console.log("[setup] DB_DRIVER không phải MySQL — bỏ qua kiểm tra MySQL");
  }

  seeded = true;
}

export default { ensureSeededAndConnected };
