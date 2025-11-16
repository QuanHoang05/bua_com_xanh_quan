#!/usr/bin/env node
const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const { URL } = require("url");

function spawnNpm(prefix, command, args = []) {
  // Use npm with --prefix so commands run inside package folders
  const cmd = "npm";
  const cmdArgs = ["--prefix", prefix, command].concat(args);
  const child = spawn(cmd, cmdArgs, { shell: true, stdio: "inherit" });
  return child;
}

function waitForUrl(address, timeout = 30000, interval = 500) {
  const start = Date.now();
  const url = new URL(address);
  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    (function check() {
      const req = lib.request(
        {
          method: "GET",
          host: url.hostname,
          port: url.port,
          path: url.pathname || "/",
        },
        (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        }
      );
      req.on("error", retry);
      req.setTimeout(2000, () => req.destroy());
      req.end();

      function retry() {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timed out waiting for ${address}`));
        } else {
          setTimeout(check, interval);
        }
      }
    })();
  });
}

async function run() {
  const root = __dirname.replace(/\\/g, "/");
  const backendPrefix = `${root}/../backend`;
  const frontendPrefix = `${root}/../frontend`;

  console.log("Starting backend...");
  const backend = spawnNpm(backendPrefix, "run", ["start"]);

  console.log("Starting frontend (vite)...");
  const frontend = spawnNpm(frontendPrefix, "run", "dev");

  const shutdown = () => {
    try {
      backend.kill();
    } catch (e) {}
    try {
      frontend.kill();
    } catch (e) {}
    process.exit(1);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    console.log("Waiting for backend http://localhost:4000 ...");
    await waitForUrl("http://localhost:4000", 30000);
    console.log("Backend ready.");

    console.log("Waiting for frontend http://localhost:5173 ...");
    await waitForUrl("http://localhost:5173", 30000);
    console.log("Frontend ready.");

    console.log("Running Cypress...");
    const cypress = spawn(
      "npx",
      [
        "cypress",
        "run",
        "--config-file",
        "cypress.config.cjs",
        "--config",
        "baseUrl=http://localhost:5173",
        "--env",
        "API_URL=http://localhost:4000",
      ],
      { shell: true, stdio: "inherit" }
    );

    cypress.on("exit", (code) => {
      console.log("Cypress finished with code", code);
      try {
        backend.kill();
      } catch (e) {}
      try {
        frontend.kill();
      } catch (e) {}
      process.exit(code);
    });
  } catch (err) {
    console.error(err.message);
    try {
      backend.kill();
    } catch (e) {}
    try {
      frontend.kill();
    } catch (e) {}
    process.exit(1);
  }
}

run();
