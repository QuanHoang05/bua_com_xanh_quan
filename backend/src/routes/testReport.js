// Route phục vụ trang báo cáo test (report HTML)
// Chú thích tiếng Việt để dễ quản lý
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Đường dẫn tệp báo cáo (tạo bởi reportGenerator)
const reportPath = path.resolve(process.cwd(), "test-report.html");

router.get("/", (_req, res) => {
  // Nếu có file HTML, trả về; nếu không, trả về JSON thông báo
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.json({
      ok: false,
      message:
        "Chưa có báo cáo. Chạy runner để tạo (IntegrationTest/runner.js).",
    });
  }
});

export default router;
