/**
 * CI / local gate: fetch live OpenAPI and verify Pact coverage
 * (same rules as ContractCoverageAuditor / TestCaseGenratorViaSwagger).
 *
 *   npm run test:swagger-coverage
 *   npm run test:swagger-coverage -- --fail-on-gap
 *   GATEWAY_BASE_URL=https://….trycloudflare.com npm run test:swagger-coverage
 *
 * Env:
 *   GATEWAY_BASE_URL / TAXMESH_BASE_URL — gateway under test (OpenAPI = {gateway}/openapi.json)
 *   SWAGGER_OPENAPI_URL — only used when same origin as gateway (stale local swagger ignored)
 *   SWAGGER_COVERAGE_FAIL=1 — exit 1 when unexpected missing ops (CI default)
 *   SWAGGER_COVERAGE_WRITE_DOC=1 — refresh docs/SWAGGER_GAP_COVERAGE.md
 */
import fs from 'fs';
import path from 'path';
import {
  formatCoverageMarkdown,
  resolveOpenApiUrl,
  resolveSwaggerUiUrl,
  runCoverageAudit,
} from '../src/swagger/coverageAudit';
import { appendCoverageHistory } from '../src/swagger/coverageHistory';
import { normalizeGatewayOrigin } from '../src/gatewayConfig';

const failOnGap =
  process.argv.includes('--fail-on-gap') ||
  process.env.SWAGGER_COVERAGE_FAIL === '1' ||
  process.env.SWAGGER_COVERAGE_FAIL === 'true';

const writeDoc =
  process.argv.includes('--write-doc') ||
  process.env.SWAGGER_COVERAGE_WRITE_DOC === '1';

const urlArgIdx = process.argv.indexOf('--url');
const urlArg =
  urlArgIdx >= 0 ? process.argv[urlArgIdx + 1] : undefined;

async function main() {
  const openApiUrl = resolveOpenApiUrl(urlArg);
  const gateway = normalizeGatewayOrigin(openApiUrl);
  const swaggerUi = resolveSwaggerUiUrl(gateway);
  console.log('\n=== Swagger ↔ Pact coverage audit ===\n');
  console.log(`Gateway : ${gateway}`);
  console.log(`OpenAPI : ${openApiUrl}`);
  console.log(`Swagger : ${swaggerUi}`);

  const report = await runCoverageAudit({ openApiUrl });

  const reportsDir = path.resolve(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, 'swagger-coverage.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const historyEntry = appendCoverageHistory(report);
  const historyFile = path.join(reportsDir, 'swagger-coverage-history.jsonl');
  const slimFile = path.join(reportsDir, 'swagger-coverage-latest-slim.json');

  console.log(`Ops      : ${report.totals.ops}`);
  console.log(`Covered  : ${report.totals.covered}`);
  console.log(`Partial  : ${report.totals.partial}`);
  console.log(`Missing  : ${report.totals.missing}`);
  console.log(`Mismatch : ${report.totals.mismatch}`);
  console.log(`Deferred : ${report.totals.deferred}`);
  console.log(`Report   : ${jsonPath}`);
  console.log(`History  : ${historyFile} (slim latest: ${slimFile})`);
  if (historyEntry.deltaVsPrevious) {
    const d = historyEntry.deltaVsPrevious;
    console.log(
      `Delta    : missing +${d.missingAdded.length}/-${d.missingRemoved.length}, mismatch +${d.mismatchAdded.length}/-${d.mismatchRemoved.length}`
    );
  }

  if (report.missing.length) {
    console.log('\nMissing operations:');
    for (const row of report.missing) {
      console.log(`  ${row.method} ${row.path}${row.note ? ` — ${row.note}` : ''}`);
    }
  }

  if (report.mismatches.length) {
    console.log('\nMismatch operations (stub/wrong-shape pact):');
    for (const row of report.mismatches) {
      console.log(`  ${row.method} ${row.path}${row.note ? ` — ${row.note}` : ''}`);
    }
  }

  if (report.deferred.length) {
    console.log('\nDeferred (not failing gate):');
    for (const row of report.deferred) {
      console.log(`  ${row.method} ${row.path} — ${row.note || ''}`);
    }
  }

  if (writeDoc) {
    const docPath = path.resolve(process.cwd(), 'docs/SWAGGER_GAP_COVERAGE.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(docPath, formatCoverageMarkdown(report), 'utf8');
    console.log(`Doc      : ${docPath}`);
  }

  if (failOnGap && report.missing.length > 0) {
    console.error(
      `\n##vso[task.logissue type=error]Swagger coverage gap: ${report.missing.length} uncovered OpenAPI operation(s). Hand off to TestCaseGenratorViaSwagger.`
    );
    process.exit(1);
  }

  if (report.missing.length === 0) {
    console.log('\nSwagger coverage gate: PASS (no unexpected missing ops).\n');
  } else {
    console.log(
      `\nSwagger coverage: ${report.missing.length} missing (warn only — pass --fail-on-gap to gate CI).\n`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
