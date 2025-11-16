// backend/src/routes/testing.js
import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

/**
 * POST /api/testing/reset
 * Endpoint đặc biệt chỉ dành cho môi trường test (E2E).
 * Chạy lại script `npm run test:db:reset` để xóa và seed lại database.
 * Điều này đảm bảo mỗi test suite bắt đầu với một môi trường dữ liệu sạch.
 */
router.post("/reset", async (_req, res) => {
  // Chỉ cho phép chạy trong môi trường test để đảm bảo an toàn
  if (process.env.NODE_ENV !== "test") {
    return res
      .status(403)
      .json({ error: "This endpoint is only available in test environment." });
  }

  try {
    console.log("[TESTING] Resetting database...");
    // Call npm script to ensure proper environment setup and Node path resolution.
    const { stdout, stderr } = await execAsync("npm run test:db:reset");
    console.log("[TESTING] Database reset stdout:", stdout);
    if (stderr) console.error("[TESTING] Database reset stderr:", stderr);
    res
      .status(200)
      .json({ message: "Database reset and seeded successfully." });
  } catch (error) {
    console.error("[TESTING] Failed to reset database:", error);
    res
      .status(500)
      .json({ error: "Failed to reset database", details: error.message });
  }
});

export default router;
