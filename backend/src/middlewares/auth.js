// backend/src/middlewares/auth.js

/**
 * Middleware để kiểm tra xem người dùng đã đăng nhập hay chưa.
 * Nó dựa vào middleware trước đó đã giải mã JWT và gắn vào `req.user`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized", message: "Yêu cầu đăng nhập." });
  }
  next();
}

/**
 * Middleware factory để tạo ra một middleware kiểm tra vai trò người dùng.
 * @param {string} role - Vai trò cần kiểm tra (vd: 'admin', 'shipper').
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const roles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role].filter(Boolean);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden", message: `Yêu cầu quyền ${role}.` });
    }
    next();
  };
}