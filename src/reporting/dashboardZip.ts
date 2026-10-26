import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { PactReport } from './types';
import { buildStandaloneInteractiveDashboard } from './interactiveDashboard';

function sanitizeReportForEmail(report: PactReport): PactReport {
  return JSON.parse(JSON.stringify(report));
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

/** Package interactive dashboard as zip (ContractTestDemo / EY_Demo pattern). */
export function packInteractiveDashboardZip(
  report: PactReport,
  options: { outputZip?: string } = {}
): string {
  const outputZip =
    options.outputZip ||
    path.join(process.cwd(), 'reports', 'TaxMesh-Contract-Dashboard.zip');
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taxmesh-dashboard-'));
  const packageRoot = path.join(stagingRoot, 'TaxMesh-Dashboard');
  const safeReport = sanitizeReportForEmail(report);

  try {
    fs.mkdirSync(path.join(packageRoot, 'data'), { recursive: true });

    const indexHtml = buildStandaloneInteractiveDashboard(safeReport);
    fs.writeFileSync(path.join(packageRoot, 'index.html'), indexHtml, 'utf8');
    fs.writeFileSync(
      path.join(packageRoot, 'service-map.html'),
      indexHtml,
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
2. Open index.html in Chrome or Edge.
3. Click microservice nodes for endpoint details.

Report data is embedded — no internet required.
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
