import fs from "fs";
import path from "path";

// Generator báo cáo HTML từ các file markdown/log của IntegrationTest
// Viết bằng tiếng Việt trong comment để dễ theo dõi

const workDir = process.cwd();
const integrationDir = path.join(workDir, "IntegrationTest");
const outFile = path.join(workDir, "test-report.html");

function readIfExists(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}

function mdToHtml(md) {
  // Rất đơn giản: escape và đổi newlines → <pre>
  if (!md) return "";
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    '<pre style="white-space:pre-wrap;word-wrap:break-word;">' + esc + "</pre>"
  );
}

export function generateReport() {
  // Đọc errorIntegration.md
  const errPath = path.join(integrationDir, "errorIntegration.md");
  const errMd =
    readIfExists(errPath) || "Không tìm thấy `errorIntegration.md`.";

  // Tìm thư mục test-reports (nếu có)
  const reportsDir = path.join(integrationDir, "test-reports");
  let reportsHtml = "";
  if (fs.existsSync(reportsDir)) {
    const files = fs
      .readdirSync(reportsDir)
      .filter(
        (f) =>
          f.endsWith(".json") ||
          f.endsWith(".xml") ||
          f.endsWith(".md") ||
          f.endsWith(".txt")
      );
    if (files.length === 0) {
      reportsHtml = "<p>Không có test-reports</p>";
    } else {
      reportsHtml = files
        .map((f) => {
          const c = readIfExists(path.join(reportsDir, f)) || "";
          return `<h3>${f}</h3>${mdToHtml(c)}`;
        })
        .join("\n");
    }
  } else {
    reportsHtml = "<p>Thư mục `test-reports` không tồn tại.</p>";
  }

  // Tổng hợp ra HTML
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Báo cáo Integration Tests</title>
  <style>
    body{font-family:Inter,Segoe UI,Arial;margin:20px}
    header{margin-bottom:20px}
    pre{background:#f7f7f7;padding:12px;border-radius:6px}
    .col{display:flex;gap:20px}
    .box{flex:1}
  </style>
</head>
<body>
  <header>
    <h1>Báo cáo Integration Tests</h1>
    <p>Được tự động tạo bởi &#96;reportGenerator&#96;.</p>
    <p><strong>Đường dẫn báo cáo:</strong> ${outFile}</p>
  </header>
  <div class="col">
    <div class="box">
      <h2>errorIntegration.md</h2>
      ${mdToHtml(errMd)}
    </div>
    <div class="box">
      <h2>Test Reports</h2>
      ${reportsHtml}
    </div>
  </div>
</body>
</html>`;

  try {
    fs.writeFileSync(outFile, html, "utf8");
    return { ok: true, path: outFile };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export default { generateReport };
