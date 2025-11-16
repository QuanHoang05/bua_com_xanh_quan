﻿// src/server.js
import app from "./app.js";
import "dotenv/config";

/* ---------- Start server ---------- */
const PORT = Number(process.env.PORT || 4000);
// Enforce JWT secret presence in production
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET === "dev_secret" ||
    process.env.JWT_SECRET === "dev-secret")
) {
  console.error(
    "FATAL: JWT_SECRET must be set to a strong secret in production"
  );
  process.exit(1);
}

// Start the server only if this file is run directly
// This check is often used for Jest tests that import 'app', but for Cypress,
// we need the server to run. The 'start:test' script handles this.
app.listen(PORT, () =>
  console.log(
    `✅ API ready at http://localhost:${PORT} [env: ${process.env.NODE_ENV}]`
  )
);

export default app;
