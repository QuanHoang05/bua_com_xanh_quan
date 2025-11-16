#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Determine mode from args or npm lifecycle
const rawArgs = process.argv.slice(2);
let mode = rawArgs.find((a) => a.startsWith("--mode="));
if (mode) mode = mode.split("=")[1];
else mode = process.env.npm_lifecycle_event || "test";

const logDir = path.resolve(process.cwd(), "test-logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Always use same log file (overwrite each run)
const logPath = path.join(logDir, "jest-test.log");

// Build jest args
const jestArgs =
  mode === "test:verbose" || mode === "verbose" ? ["--verbose"] : [];

const out = fs.createWriteStream(logPath, { flags: "w" });

console.log(`Running jest (${mode}) and writing log to: ${logPath}`);

// Use npx to run jest with shell support
const child = spawn("npx", ["jest", ...jestArgs], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NODE_ENV: "test",
  },
  cwd: process.cwd(),
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  out.write(chunk);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  out.write(chunk);
});

child.on("close", (code) => {
  out.end();
  console.log(`\nJest exited with code ${code}. Log saved to ${logPath}`);
  process.exit(code);
});

child.on("error", (err) => {
  console.error(`Failed to start test process: ${err.message}`);
  out.end();
  process.exit(1);
});
