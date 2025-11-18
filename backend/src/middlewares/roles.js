export function requireRole(...roles) {
  return async (req, res, next) => {
    const current = String(req.user?.role ?? "").toLowerCase();

    // If no role in token, reject
    if (!current)
      return res.status(403).json({ message: "Forbidden: insufficient role" });

    // Helper: try to fetch authoritative role from DB if possible
    async function getRoleFromDb(userId) {
      try {
        const useMySQL =
          (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
        let dbModule;
        if (useMySQL) { // Sửa lỗi: import đúng module cho MySQL
          dbModule = await import("../lib/db.mysql.js");
        } else {
          dbModule = await import("../lib/db.js");
        }
        const db = dbModule.db;
        if (!db) return null;
        if (typeof db.get === "function") {
          const row = await db.get("SELECT role FROM users WHERE id = ?", [
            userId,
          ]);
          return row?.role?.toLowerCase() ?? null;
        }
        if (typeof db.query === "function") {
          const [rows] = await db.query("SELECT role FROM users WHERE id = ?", [
            userId,
          ]);
          return rows?.[0]?.role?.toLowerCase() ?? null;
        }
      } catch (e) {
        // If DB not available in this environment, ignore and fall back to token
        return null;
      }
      return null;
    }

    // If user id available, prefer DB role when possible
    if (req.user?.id) {
      const dbRole = await getRoleFromDb(req.user.id);
      if (dbRole) {
        // Admin in DB always allowed
        if (dbRole === "admin") return next();
        // If DB role doesn't match required roles, reject
        if (!roles.map((r) => String(r).toLowerCase()).includes(dbRole)) {
          return res
            .status(403)
            .json({ message: "Forbidden: insufficient role" });
        }
        return next();
      }
    }

    // Fallback: use role from token
    if (!roles.map((r) => String(r).toLowerCase()).includes(current)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
