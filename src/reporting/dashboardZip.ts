import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { PactReport } from './types';
import { buildStandaloneInteractiveDashboard } from './interactiveDashboard';

function sanitizeReportForEmail(report: PactReport): PactReport {
  const copy = JSON.parse(JSON.stringify(report)) as PactReport;
  return copy;
}

function encodeReportForHtmlEmbed(report: PactReport): string {
  return Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
}

/** Embed report so the zip works offline with no .js fetch. */
function buildInlineReportBootstrapHtml(report: PactReport): string {
  const encoded = encodeReportForHtmlEmbed(report);
  return `<script id="pact-report-data" type="text/plain" data-encoding="base64">${encoded}</script>
<script>window.__PACT_REPORT__=JSON.parse(atob(document.getElementById('pact-report-data').textContent.trim()));</script>`;
}

function prepareDashboardIndexHtml(sourceHtml: string, report: PactReport): string {
  const bootstrap = buildInlineReportBootstrapHtml(sanitizeReportForEmail(report));
  if (/<script\s+src=["']data\/latest\.js["']\s*>\s*<\/script>/i.test(sourceHtml)) {
    return sourceHtml.replace(/<script\s+src=["']data\/latest\.js["']\s*>\s*<\/script>/i, bootstrap);
  }
  // Fallback: inject before </body>
  return sourceHtml.replace(/<\/body>/i, `${bootstrap}\n</body>`);
}

function zipDirectory(sourceDir: string, zipPath: string) {
  const resolvedZip = path.resolve(zipPath);
  const resolvedSource = path.resolve(sourceDir);
  if (process.platform === 'win32') {
    const psSource = resolvedSource.replace(/'/g, "''");
    const psZip = resolvedZip.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${psSource}\\*' -DestinationPath '${psZip}' -Force"`,
      { stdio: 'pipe' }
    );
    return;
  }
  execSync(`zip -rq "${resolvedZip}" .`, { cwd: resolvedSource, stdio: 'pipe' });
}

/**
 * Package interactive TaxMesh dashboard as zip:
 *   index.html          — full KPI dashboard with embedded report
 *   service-map.html    — clickable map-only view
 *   data/report.json    — raw report
 *   README.txt
 */
export function packInteractiveDashboardZip(
  report: PactReport,
  options: { outputZip?: string } = {}
): string {
  const outputZip =
    options.outputZip ||
    path.join(process.cwd(), 'reports', 'TaxMesh-Contract-Dashboard.zip');
  const dashboardRoot = path.join(process.cwd(), 'dashboard');
  const indexSource = path.join(dashboardRoot, 'index.html');
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taxmesh-dashboard-'));
  const packageRoot = path.join(stagingRoot, 'TaxMesh-Dashboard');
  const safeReport = sanitizeReportForEmail(report);

  try {
    fs.mkdirSync(path.join(packageRoot, 'data'), { recursive: true });

    if (!fs.existsSync(indexSource)) {
      throw new Error(`Dashboard not found at ${indexSource}`);
    }

    const indexHtml = prepareDashboardIndexHtml(
      fs.readFileSync(indexSource, 'utf8'),
      safeReport
    );
    fs.writeFileSync(path.join(packageRoot, 'index.html'), indexHtml, 'utf8');

    fs.writeFileSync(
      path.join(packageRoot, 'service-map.html'),
      buildStandaloneInteractiveDashboard(safeReport),
      'utf8'
    );

    fs.writeFileSync(
      path.join(packageRoot, 'data', 'report.json'),
      JSON.stringify(safeReport, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(packageRoot, 'README.txt'),
      `TaxMesh Contract Test Dashboard
================================

1. Unzip this folder.
2. Open index.html in Chrome or Edge (double-click after unzip).
3. Click microservice nodes on the map for endpoint details.

Optional: open service-map.html for the map-only view.

Report data is embedded safely in index.html — no internet required.
`,
      'utf8'
    );

    fs.mkdirSync(path.dirname(outputZip), { recursive: true });
    if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip);
    zipDirectory(packageRoot, outputZip);
    return outputZip;
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}
