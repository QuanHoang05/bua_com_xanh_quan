// testAPIreal/dbHelper.js
import mysql from "mysql2/promise";
import "dotenv/config";

let pool;

/**
 * Lấy kết nối pool tới CSDL.
 * Chỉ tạo pool một lần duy nhất.
 * @returns {import('mysql2/promise').Pool}
 */
function getPool() {
  if (!pool) {
    // Đọc cấu hình từ .env.test
    const config = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
      charset: "utf8mb4",
    };
    console.log(`[DB Helper] Đang tạo pool kết nối tới CSDL test: ${config.database}`);
    pool = mysql.createPool(config);
  }
  return pool;
}

/**
 * Hàm này sẽ xóa toàn bộ dữ liệu trong các bảng được chỉ định.
 * Nó được gọi trước mỗi bộ test để đảm bảo môi trường sạch.
 */
export async function cleanupDatabase() {
  const dbPool = getPool();
  const [rows] = await dbPool.query("SHOW TABLES");
  const tables = rows.map((r) => r[Object.keys(r)[0]]);

  console.log(`[DB Helper] Chuẩn bị dọn dẹp ${tables.length} bảng...`);

  // Tắt kiểm tra khóa ngoại để có thể xóa dữ liệu
  await dbPool.query("SET FOREIGN_KEY_CHECKS = 0;");

  for (const table of tables) {
    // Dùng TRUNCATE để reset bảng và auto_increment
    await dbPool.query(`TRUNCATE TABLE \`${table}\`;`);
  }

  // Bật lại kiểm tra khóa ngoại
  await dbPool.query("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("[DB Helper] Đã dọn dẹp CSDL thành công.");
}

/**
 * Chèn dữ liệu mẫu vào một bảng cụ thể.
 * @param {string} table Tên bảng
 * @param {object[]} data Mảng các object dữ liệu
 */
export async function seedData(table, data) {
  if (!data || data.length === 0) return;

  const dbPool = getPool();
  const columns = Object.keys(data[0]);
  const values = data.map((row) => columns.map((col) => row[col]));

  const sql = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES ?`;
  await dbPool.query(sql, [values]);
  console.log(`[DB Helper] Đã seed ${data.length} dòng vào bảng '${table}'.`);
}

/**
 * Đóng tất cả kết nối trong pool.
 * Gọi sau khi toàn bộ các test đã chạy xong.
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[DB Helper] Đã đóng pool kết nối CSDL test.");
  }
}