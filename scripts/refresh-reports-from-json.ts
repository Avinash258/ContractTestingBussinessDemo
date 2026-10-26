/**
 * Regenerate HTML / Excel / dashboard zip from an existing pact-report.json
 * without re-running consumer/provider tests.
 *
 *   npx ts-node --transpile-only scripts/refresh-reports-from-json.ts
 */
import fs from 'fs';
import path from 'path';
import { buildReport, writeReports } from '../src/reporting/generateReport';
import { enrichPhaseEndpoints } from '../src/reporting/pactEndpointLookup';
import { config } from '../src/config';
import type { PactReport } from '../src/reporting/types';

async function main() {
  const reportPath = path.resolve(process.cwd(), 'reports', 'pact-report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing ${reportPath}. Run contract tests first.`);
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as PactReport;
  const consumer = enrichPhaseEndpoints(raw.consumer, config.pactsDir);
  const provider = enrichPhaseEndpoints(raw.provider, config.pactsDir);
  const report = buildReport({
    consumer,
    provider,
    pactFiles: raw.pactFiles || [],
    environment: {
      ...(raw.environment || {}),
      BUILD_SOURCEVERSION:
        raw.environment?.BUILD_SOURCEVERSION || process.env.BUILD_SOURCEVERSION || '',
      RUN_MODE: raw.environment?.RUN_MODE || 'refresh',
    },
  });

  // Preserve original timestamp when refreshing artifacts
  report.generatedAt = raw.generatedAt || report.generatedAt;

  const paths = await writeReports(report);
  console.log('Refreshed report artifacts:');
  console.log(`  JSON  : ${paths.jsonPath}`);
  console.log(`  HTML  : ${paths.htmlPath}`);
  console.log(`  Excel : ${paths.excelPath || '(failed)'}`);
  console.log(`  Zip   : ${paths.dashboardZipPath || '(failed)'}`);
  console.log(`  Map   : ${paths.interactivePath}`);

  // Quick sanity checks
  const checks: Array<[string, boolean]> = [
    ['pact-report.html exists', fs.existsSync(paths.htmlPath)],
    ['Excel exists', !!paths.excelPath && fs.existsSync(paths.excelPath)],
    ['Dashboard zip exists', !!paths.dashboardZipPath && fs.existsSync(paths.dashboardZipPath)],
    ['dashboard/data/latest.json exists', fs.existsSync(path.join('dashboard', 'data', 'latest.json'))],
    [
      'dashboard excel copy exists',
      fs.existsSync(path.join('dashboard', 'data', 'TaxMesh-Contract-Report.xlsx')),
    ],
    ['HTML has Expand all', fs.readFileSync(paths.htmlPath, 'utf8').includes('Expand all')],
    ['HTML has Load more', fs.readFileSync(paths.htmlPath, 'utf8').includes('Load more')],
    [
      'Dashboard has Download Excel',
      fs.readFileSync(path.join('dashboard', 'index.html'), 'utf8').includes('Download Excel'),
    ],
    [
      'Dashboard uses durationMs',
      fs.readFileSync(path.join('dashboard', 'index.html'), 'utf8').includes('item.durationMs'),
    ],
  ];

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}`);
    if (!ok) failed += 1;
  }

  // Spot-check provider endpoint enrichment
  const emptyEndpoints = (report.provider.interactions || []).filter((ix) => !ix.endpoint).length;
  const totalProvider = (report.provider.interactions || []).length;
  console.log(
    `  Provider endpoints filled: ${totalProvider - emptyEndpoints}/${totalProvider} (empty=${emptyEndpoints})`
  );

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
