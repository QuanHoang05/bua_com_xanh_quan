﻿import "dotenv/config";

// File này đóng vai trò là một "bộ điều phối" (dispatcher) động.
// Dựa vào biến môi trường DB_DRIVER, nó sẽ chọn và export đúng module DB tương ứng.
let db, migrate;

if ((process.env.DB_DRIVER || "sqlite") === "mysql") {
  // Nếu driver là mysql, import từ file db.mysql.js
  const m = await import("./db.mysql.js");
  db = m.db;
  migrate = async () => {}; // MySQL không cần migrate tự động trong code này
} else {
  // Mặc định, hoặc khi driver là sqlite, import từ file db.sqlite.js
  const m = await import("./db.sqlite.js");
  db = m.db;
  migrate = m.migrate;
}

export { db, migrate };
