// Minimal custom reporter used by integration test config.
class TestReporter {
  constructor(globalConfig, options) {
    this._options = options || {};
  }

  onRunComplete(contexts, results) {
    try {
      // Ensure output directory exists and optionally write a small summary file
      const fs = require("fs");
      const path = require("path");
      const rawOut = this._options.outputPath || "test-reports";
      // allow <rootDir> token used in jest config to resolve to process.cwd()
      const outPath = String(rawOut).replace(/<rootDir>/g, process.cwd());
      const outDir = path.resolve(process.cwd(), outPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const file = path.join(outDir, "integration-summary.txt");
      const summary = `Tests: ${results.numTotalTests}, Passed: ${results.numPassedTests}, Failed: ${results.numFailedTests}\n`;
      fs.writeFileSync(file, summary, "utf8");
      // Log to console a short summary
      // eslint-disable-next-line no-console
      console.log("[test-reporter] Integration summary written to", file);
    } catch (e) {
      // ignore reporter errors
      // eslint-disable-next-line no-console
      console.warn("[test-reporter] Could not write summary", e && e.message);
    }
  }
}

module.exports = TestReporter;
