import fs from 'fs';
import path from 'path';
import { buildTaxMeshServiceMap, buildServiceMapSvg } from './serviceMap';
import { packInteractiveDashboardZip } from './dashboardZip';
import { buildStandaloneInteractiveDashboard } from './interactiveDashboard';
import type { InteractionResult, PactReport, PhaseStatus, PhaseSummary } from './types';

const REPORTS_DIR = path.resolve(process.cwd(), 'reports');

export function ensureReportsDir(): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  return REPORTS_DIR;
}

function statusFromCounts(passed: number, failed: number, ran: boolean): PhaseStatus {
  if (!ran) return 'skipped';
  if (failed > 0) return 'failed';
  if (passed > 0) return 'passed';
  return 'unknown';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: PhaseStatus | string): string {
  const normalized =
    status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : status === 'skipped' ? 'skipped' : 'unknown';
  return `<span class="badge badge-${normalized}">${escapeHtml(normalized.toUpperCase())}</span>`;
}

function parseEndpoint(title: string): string {
  const m = String(title).match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : '';
}

export function summarizeConsumerFromJest(jestResults: any | null): PhaseSummary {
  const interactions: InteractionResult[] = [];
  const tests: NonNullable<PhaseSummary['tests']> = [];
  const failures: NonNullable<PhaseSummary['failures']> = [];

  if (!jestResults) {
    return {
      status: 'unknown',
      total: 0,
      passed: 0,
      failed: 0,
      durationMs: 0,
      label: 'Consumer contract tests (Jest + Pact mock server)',
      interactions,
      tests,
      failures,
      ran: false,
    };
  }

  for (const suite of jestResults.testResults || []) {
    for (const test of suite.assertionResults || []) {
      const failed = test.status === 'failed';
      const reason = failed
        ? (test.failureMessages || []).join('\n').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 500)
        : undefined;
      const endpoint = parseEndpoint(test.title || test.fullName || '');
      interactions.push({
        description: test.fullName || test.title,
        provider: 'mock',
        endpoint,
        status: failed ? 'failed' : test.status === 'passed' ? 'passed' : 'unknown',
        durationMs: test.duration || 0,
        reason,
      });
      tests.push({
        suite: suite.name,
        name: test.title,
        endpoint,
        status: test.status,
        durationMs: test.duration || 0,
        reason,
      });
      if (failed) {
        failures.push({ test: test.title, endpoint, reason });
      }
    }
  }

  const passed = jestResults.numPassedTests ?? interactions.filter((i) => i.status === 'passed').length;
  const failed = jestResults.numFailedTests ?? interactions.filter((i) => i.status === 'failed').length;
  const total = jestResults.numTotalTests ?? interactions.length;
  const durationMs =
    jestResults.testResults?.reduce(
      (sum: number, s: any) => sum + Math.max(0, (s.endTime || 0) - (s.startTime || 0)),
      0
    ) || 0;

  return {
    status: statusFromCounts(passed, failed, true),
    total,
    passed,
    failed,
    durationMs,
    label: 'Consumer contract tests (Jest + Pact mock server)',
    interactions,
    tests,
    failures,
    ran: true,
  };
}

export function summarizeProviderFromResults(
  providerBlocks: Array<{
    provider: string;
    success: boolean;
    interactionResults?: Array<{ description: string; result?: string; duration?: string }>;
    errors?: Array<{ interaction?: string; mismatch?: unknown }>;
    durationMs?: number;
  }>
): PhaseSummary {
  const interactions: InteractionResult[] = [];
  const failures: NonNullable<PhaseSummary['failures']> = [];
  let passed = 0;
  let failed = 0;
  let durationMs = 0;

  for (const block of providerBlocks) {
    durationMs += block.durationMs || 0;
    const results = block.interactionResults || [];
    if (results.length === 0 && !block.success) {
      failed += 1;
      const reason = JSON.stringify(block.errors || []).slice(0, 500);
      interactions.push({
        description: `${block.provider} verification`,
        provider: block.provider,
        status: 'failed',
        reason,
      });
      failures.push({ interaction: block.provider, reason });
      continue;
    }
    for (const r of results) {
      const ok = String(r.result || '').toUpperCase() === 'OK' || r.result === 'passed';
      if (ok) passed += 1;
      else failed += 1;
      const err = (block.errors || []).find((e) =>
        String(e.interaction || '').includes(r.description)
      );
      const reason = err ? JSON.stringify(err.mismatch || err).slice(0, 500) : undefined;
      interactions.push({
        description: r.description,
        provider: block.provider,
        endpoint: parseEndpoint(r.description),
        status: ok ? 'passed' : 'failed',
        durationMs: r.duration ? Number(String(r.duration).replace(/ms/, '')) || 0 : 0,
        reason,
        expected: ok ? 'Matched' : 'See mismatch',
        actual: ok ? 'Matched' : reason?.slice(0, 120),
      });
      if (!ok) {
        failures.push({ interaction: r.description, reason });
      }
    }
  }

  const total = passed + failed;
  return {
    status: statusFromCounts(passed, failed, providerBlocks.length > 0),
    total,
    passed,
    failed,
    durationMs,
    label: 'Provider verification (live TaxMesh APIs against pact files)',
    interactions,
    failures,
    ran: providerBlocks.length > 0,
    providerBaseUrl:
      process.env.GATEWAY_BASE_URL ||
      process.env.TAXMESH_BASE_URL ||
      process.env.PACT_PROVIDER_URL ||
      'not run',
    skippedReason:
      providerBlocks.length === 0
        ? 'Provider verification was not run (consumer-only mode).'
        : undefined,
  };
}

function topFailureHighlights(report: PactReport, limit = 8) {
  const rows: Array<{
    phase: string;
    endpoint: string;
    name: string;
    expected: string;
    actual: string;
  }> = [];

  for (const f of report.consumer.failures || []) {
    rows.push({
      phase: 'Consumer',
      endpoint: f.endpoint || '—',
      name: f.test || '—',
      expected: 'Pass',
      actual: f.reason || 'Failed',
    });
  }
  for (const ix of report.provider.interactions || []) {
    if (ix.status !== 'failed') continue;
    rows.push({
      phase: 'Provider',
      endpoint: ix.endpoint || '—',
      name: ix.description,
      expected: ix.expected || '—',
      actual: ix.actual || ix.reason || '—',
    });
  }
  return rows.slice(0, limit);
}

function buildPhaseCards(report: PactReport): string {
  const phaseCard = (phase: PhaseSummary, title: string, subtitle: string, scoreLabel: string) => `
    <div class="phase-card phase-${phase.status}">
      <div class="phase-head">
        <h3>${escapeHtml(title)}</h3>
        ${statusBadge(phase.status)}
      </div>
      <p class="meta">${escapeHtml(subtitle)}</p>
      <div class="phase-score"><strong>${phase.passed}/${phase.total}</strong> ${escapeHtml(scoreLabel)}</div>
      <p class="phase-ran">Executed: <strong>${phase.ran ? 'Yes' : 'No'}</strong></p>
    </div>`;

  return `
    <section class="card phase-summary">
      <h2>Pipeline phases</h2>
      <p class="meta">Consumer generates pact files; provider verifies them against the live TaxMesh API.</p>
      <div class="phase-grid">
        ${phaseCard(report.consumer, '1. Consumer', report.consumer.label, 'tests passed')}
        ${phaseCard(report.provider, '2. Provider', report.provider.label, 'interactions passed')}
      </div>
    </section>`;
}

function buildFailureBlocks(
  failures: NonNullable<PhaseSummary['failures']> | undefined,
  title: string
): string {
  if (!failures?.length) return '';
  const blocks = failures
    .map((failure) => {
      const name = failure.test || failure.interaction || 'Failure';
      const endpointLine = failure.endpoint
        ? `<p><strong>Endpoint:</strong> <code>${escapeHtml(failure.endpoint)}</code></p>`
        : '';
      return `
        <div class="failure-block">
          <h4>${escapeHtml(name)}</h4>
          ${endpointLine}
          <p>${escapeHtml(failure.reason || 'No detailed mismatch information.')}</p>
        </div>`;
    })
    .join('');
  return `<h3>${escapeHtml(title)}</h3>${blocks}`;
}

/** EY_Demo / ContractTestDemo light-theme HTML report. */
export function renderHtmlReport(report: PactReport): string {
  const consumerRows = (report.consumer.tests || report.consumer.interactions)
    .map((test: any) => {
      const name = test.name || test.description;
      const suite = test.suite ? path.basename(test.suite) : test.provider || '—';
      const status = test.status;
      const reason = status === 'failed' ? test.reason || '-' : '—';
      return `
        <tr>
          <td>${escapeHtml(test.endpoint || '—')}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(suite)}</td>
          <td>${statusBadge(status)}</td>
          <td>${escapeHtml(reason)}</td>
          <td>${test.durationMs || 0}ms</td>
        </tr>`;
    })
    .join('');

  const providerRows = report.provider.interactions
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.endpoint || '—')}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${statusBadge(item.status)}</td>
          <td>${escapeHtml(item.expected || '—')}</td>
          <td>${escapeHtml(item.actual || '—')}</td>
          <td>${item.durationMs ?? '-'}ms</td>
        </tr>`
    )
    .join('');

  const providerEmptyMessage =
    report.provider.status === 'skipped'
      ? escapeHtml(report.provider.skippedReason || 'Provider verification was not run.')
      : 'Provider verification was not run.';

  const providerTableBody =
    providerRows || `<tr><td colspan="6">${providerEmptyMessage}</td></tr>`;

  const highlightRows = topFailureHighlights(report)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.phase)}</td>
          <td>${escapeHtml(item.endpoint)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.expected)}</td>
          <td>${escapeHtml(item.actual)}</td>
        </tr>`
    )
    .join('');

  const svg = buildServiceMapSvg(report.serviceMap as any, { light: false });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TaxMesh Pact Test Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #dbe3ef;
      --passed: #15803d;
      --failed: #b91c1c;
      --skipped: #a16207;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Segoe UI, Tahoma, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .header, .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    h1, h2, h3, h4 { margin-top: 0; }
    .meta { color: var(--muted); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .metric { border: 1px solid var(--border); border-radius: 10px; padding: 14px; background: #fafcff; }
    .metric strong { display: block; font-size: 1.4rem; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid var(--border); padding: 10px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    .badge-passed { background: var(--passed); }
    .badge-failed { background: var(--failed); }
    .badge-skipped, .badge-unknown { background: var(--skipped); }
    .failure-block { border: 1px solid #fecaca; background: #fff7f7; border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
    .overall-passed { color: var(--passed); }
    .overall-failed { color: var(--failed); }
    .phase-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 12px; }
    .phase-card { border: 1px solid var(--border); border-radius: 12px; padding: 16px; background: #fafcff; }
    .phase-card.phase-passed { border-color: #86efac; }
    .phase-card.phase-failed { border-color: #fca5a5; }
    .phase-card.phase-skipped { border-color: #fcd34d; }
    .phase-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
    .phase-head h3 { margin: 0; font-size: 1.05rem; }
    .phase-score strong { font-size: 1.5rem; }
    .phase-ran { margin-top: 8px; font-size: 0.9rem; color: var(--muted); }
    code { background: #eef2ff; padding: 2px 6px; border-radius: 6px; }
    .service-map-wrap { overflow-x: auto; margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; background: #0f172a; }
  </style>
</head>
<body>
  <div class="container">
    <section class="header">
      <h1>TaxMesh Pact Test Report</h1>
      <p class="meta">Generated at ${escapeHtml(report.generatedAt)} · Pattern: ContractTestDemo / EY_Demo</p>
      <p>
        Overall status:
        <strong class="overall-${report.overallStatus === 'passed' ? 'passed' : 'failed'}">
          ${escapeHtml(report.overallStatus.toUpperCase())}
        </strong>
      </p>
      <div class="summary-grid">
        <div class="metric"><strong>${statusBadge(report.consumer.status)}</strong>Consumer ${report.consumer.passed}/${report.consumer.total}</div>
        <div class="metric"><strong>${statusBadge(report.provider.status)}</strong>Provider ${report.provider.passed}/${report.provider.total}</div>
        <div class="metric"><strong>${escapeHtml(String(report.pactFiles.length))}</strong>Pact file(s) generated</div>
        <div class="metric"><strong>${escapeHtml(report.environment.GATEWAY_BASE_URL || report.provider.providerBaseUrl || 'n/a')}</strong>Verification URL</div>
      </div>
    </section>

    ${buildPhaseCards(report)}

    <section class="card service-map-card">
      <h2>Microservice map</h2>
      <p class="meta">Live contract-test status across TaxMesh services (CLM → DOC + Gateway). Green = OK, red = failure.</p>
      <div class="service-map-wrap">${svg}</div>
    </section>

    ${
      highlightRows
        ? `<section class="card">
      <h2>Failure highlights</h2>
      <p class="meta">Endpoint, expected, and actual values for failed tests.</p>
      <table>
        <thead><tr><th>Phase</th><th>Endpoint</th><th>Test / interaction</th><th>Expected</th><th>Actual</th></tr></thead>
        <tbody>${highlightRows}</tbody>
      </table>
    </section>`
        : ''
    }

    <section class="card">
      <h2>Consumer Contract Tests</h2>
      <p class="meta">Step 1 — ${escapeHtml(report.consumer.label)}</p>
      ${statusBadge(report.consumer.status)}
      <table>
        <thead><tr><th>Endpoint</th><th>Test</th><th>Suite</th><th>Status</th><th>Reason</th><th>Duration</th></tr></thead>
        <tbody>${consumerRows || '<tr><td colspan="6">No consumer test results available.</td></tr>'}</tbody>
      </table>
      ${buildFailureBlocks(report.consumer.failures, 'Consumer failure details')}
    </section>

    <section class="card">
      <h2>Provider Verification</h2>
      <p class="meta">Step 2 — ${escapeHtml(report.provider.label)}</p>
      ${statusBadge(report.provider.status)}
      <table>
        <thead><tr><th>Endpoint</th><th>Interaction</th><th>Status</th><th>Expected</th><th>Actual</th><th>Duration</th></tr></thead>
        <tbody>${providerTableBody}</tbody>
      </table>
      ${buildFailureBlocks(report.provider.failures, 'Provider failure details')}
    </section>

    <section class="card">
      <h2>Artifacts</h2>
      <ul>
        <li>JSON report: <code>reports/pact-report.json</code></li>
        <li>HTML report: <code>reports/pact-report.html</code></li>
        <li>Interactive map: <code>reports/interactive-service-map.html</code></li>
        <li>Dashboard zip: <code>reports/TaxMesh-Contract-Dashboard.zip</code></li>
        <li>Pact files: ${report.pactFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ') || 'None'}</li>
      </ul>
    </section>
  </div>
</body>
</html>`;
}

export function buildReport(input: {
  consumer: PhaseSummary;
  provider: PhaseSummary;
  pactFiles: string[];
  environment?: Record<string, string>;
}): PactReport {
  const overallFailed = input.consumer.failed + input.provider.failed;
  const consumerOk = !input.consumer.ran || input.consumer.status === 'passed';
  const providerOk =
    !input.provider.ran ||
    input.provider.status === 'passed' ||
    input.provider.status === 'skipped';
  const overallStatus: PhaseStatus =
    !input.consumer.ran && !input.provider.ran
      ? 'unknown'
      : overallFailed > 0 || !consumerOk || (input.provider.ran && input.provider.status === 'failed')
        ? 'failed'
        : consumerOk && providerOk
          ? 'passed'
          : 'unknown';

  const serviceMap = buildTaxMeshServiceMap(input.consumer, input.provider);

  return {
    generatedAt: new Date().toISOString(),
    project: 'TaxMesh Pact Contract Tests',
    overallStatus,
    consumer: input.consumer,
    provider: input.provider,
    pactFiles: input.pactFiles,
    serviceMap,
    phases: {
      consumer: {
        ran: input.consumer.ran,
        status: input.consumer.status,
        passed: input.consumer.passed,
        total: input.consumer.total,
        failed: input.consumer.failed,
        label: input.consumer.label,
      },
      provider: {
        ran: input.provider.ran,
        status: input.provider.status,
        passed: input.provider.passed,
        total: input.provider.total,
        failed: input.provider.failed,
        label: input.provider.label,
        providerBaseUrl: input.provider.providerBaseUrl,
      },
    },
    environment: input.environment || {},
  };
}

export function writeReports(report: PactReport): {
  jsonPath: string;
  htmlPath: string;
  interactivePath: string;
  dashboardZipPath: string;
} {
  const dir = ensureReportsDir();
  const jsonPath = path.join(dir, 'pact-report.json');
  const latestPath = path.join(dir, 'latest.json');
  const htmlPath = path.join(dir, 'pact-report.html');
  const interactivePath = path.join(dir, 'interactive-service-map.html');

  const html = renderHtmlReport(report);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');

  fs.writeFileSync(interactivePath, buildStandaloneInteractiveDashboard(report), 'utf8');

  const dashboardDataDir = path.join(process.cwd(), 'dashboard', 'data');
  fs.mkdirSync(dashboardDataDir, { recursive: true });
  fs.writeFileSync(path.join(dashboardDataDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(dashboardDataDir, 'latest.js'),
    `window.__PACT_REPORT__ = ${JSON.stringify(report).replace(/</g, '\\u003c')};\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(dashboardDataDir, 'interactive-service-map.html'),
    buildStandaloneInteractiveDashboard(report),
    'utf8'
  );

  let dashboardZipPath = '';
  try {
    dashboardZipPath = packInteractiveDashboardZip(report);
    console.log(`Interactive dashboard zip: ${dashboardZipPath}`);
  } catch (error: any) {
    console.warn(`Failed to package interactive dashboard zip: ${error.message}`);
  }

  return { jsonPath, htmlPath, interactivePath, dashboardZipPath };
}
