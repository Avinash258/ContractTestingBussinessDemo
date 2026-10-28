import fs from 'fs';
import path from 'path';
import { buildTaxMeshServiceMap, buildServiceMapSvg } from './serviceMap';
import { packInteractiveDashboardZip } from './dashboardZip';
import { normalizeReportMismatches, parsePactMismatch } from './mismatchFormat';
import { buildStandaloneInteractiveDashboard } from './interactiveDashboard';
import { enrichPhaseEndpoints } from './pactEndpointLookup';
import { loadCoverageRows, writeExcelReport } from './excelReport';
import { config } from '../config';
import type { InteractionResult, PactReport, PhaseStatus, PhaseSummary } from './types';

function parseMethodPath(endpoint: string): { method: string; path: string } {
  const m = String(endpoint || '')
    .trim()
    .match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
  if (m) return { method: m[1].toUpperCase(), path: m[2] };
  return { method: '', path: String(endpoint || '') };
}

function attachCoverage(report: PactReport): PactReport {
  const rows = loadCoverageRows();
  const consumerGaps = rows
    .filter((r) => r.status === 'missing')
    .map((r) => ({
      method: r.method,
      path: r.path,
      note: r.notes || 'No consumer/pact contract covers this OpenAPI operation',
      operation: r.operation,
    }));

  // Provider gaps = failed provider interactions (verification against live API)
  const providerGaps = (report.provider?.interactions || [])
    .filter((ix) => ix.status === 'failed')
    .map((ix) => {
      const parsed = parseMethodPath(ix.endpoint || '');
      return {
        method: parsed.method || ix.method || '',
        path: parsed.path || ix.path || ix.endpoint || '',
        note: ix.reason || `${ix.expected || ''} → ${ix.actual || ''}`.trim() || 'Provider verification failed',
        operation: ix.description || '',
      };
    });

  // Also fold structured provider.failures if present
  for (const failure of report.provider?.failures || []) {
    const parsed = parseMethodPath(failure.endpoint || '');
    const already = providerGaps.some(
      (g) =>
        g.path === (parsed.path || failure.endpoint) &&
        g.operation === (failure.interaction || '')
    );
    if (already) continue;
    providerGaps.push({
      method: parsed.method,
      path: parsed.path || failure.endpoint || '',
      note: failure.reason || 'Provider verification failed',
      operation: failure.interaction || '',
    });
  }

  if (!rows.length && !providerGaps.length) return report;

  const covered = rows.filter((r) => r.status === 'covered').length;
  const partial = rows.filter((r) => r.status === 'partial').length;
  const deferred = rows.filter((r) => r.status === 'deferred').length;
  const missing = rows.filter((r) => r.status === 'missing').length;

  report.coverage = {
    totals: {
      ops: rows.length,
      covered,
      partial,
      missing,
      deferred,
    },
    rows: rows.map((r) => ({
      method: r.method,
      path: r.path,
      status: r.status,
      notes: r.notes,
      operation: r.operation,
      originalStatus: r.originalStatus,
    })),
    gaps: {
      consumer: consumerGaps,
      provider: providerGaps,
    },
  };

  // Swagger / provider gaps force a FAIL report for email + dashboard
  if (consumerGaps.length > 0 || providerGaps.length > 0) {
    report.overallStatus = 'failed';
  }

  return report;
}

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
        suite: path.basename(String(suite.name || '')),
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
      const parsed = parsePactMismatch(block.errors?.[0]?.mismatch ?? block.errors);
      interactions.push({
        description: `${block.provider} verification`,
        provider: block.provider,
        status: 'failed',
        reason: parsed.summary,
        expected: parsed.expected,
        actual: parsed.actual,
      });
      failures.push({
        interaction: block.provider,
        reason: parsed.summary,
        expected: parsed.expected,
        actual: parsed.actual,
        details: parsed.details,
      });
      continue;
    }
    for (const r of results) {
      const ok = String(r.result || '').toUpperCase() === 'OK' || r.result === 'passed';
      if (ok) passed += 1;
      else failed += 1;
      const err = (block.errors || []).find((e) =>
        String(e.interaction || '').includes(r.description)
      );
      const parsed = !ok
        ? parsePactMismatch(err?.mismatch ?? err ?? r.description)
        : null;
      const endpoint = parseEndpoint(r.description);
      interactions.push({
        description: r.description,
        provider: block.provider,
        endpoint,
        status: ok ? 'passed' : 'failed',
        durationMs: r.duration ? Number(String(r.duration).replace(/ms/, '')) || 0 : 0,
        reason: parsed?.summary,
        expected: ok ? 'Matched' : parsed?.expected || 'Contract match',
        actual: ok ? 'Matched' : parsed?.actual || parsed?.summary || 'Failed',
      });
      if (!ok && parsed) {
        failures.push({
          interaction: r.description,
          endpoint,
          reason: parsed.summary,
          expected: parsed.expected,
          actual: parsed.actual,
          details: parsed.details,
        });
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
  const consumerOpen = (report.consumer.failed || 0) > 0 ? ' open' : '';
  const providerOpen = (report.provider.failed || 0) > 0 ? ' open' : '';
  const env = report.environment || {};

  const consumerRows = (report.consumer.tests || report.consumer.interactions)
    .map((test: any) => {
      const name = test.name || test.description;
      const suite = test.suite ? path.basename(test.suite) : test.provider || '—';
      const status = test.status;
      const reason = status === 'failed' ? test.reason || '-' : '—';
      return `
        <tr data-status="${escapeHtml(status)}" data-text="${escapeHtml(`${test.endpoint || ''} ${name} ${suite}`.toLowerCase())}">
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
        <tr data-status="${escapeHtml(item.status)}" data-text="${escapeHtml(`${item.endpoint || ''} ${item.description || ''}`.toLowerCase())}">
          <td>${escapeHtml(item.endpoint || '—')}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${statusBadge(item.status)}</td>
          <td>${escapeHtml(item.expected || '—')}</td>
          <td>${escapeHtml(item.actual || '—')}</td>
          <td>${item.durationMs ?? 0}ms</td>
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
  const buildMeta = [
    env.BUILD_BUILDID ? `Build ${escapeHtml(env.BUILD_BUILDID)}` : '',
    env.BUILD_SOURCEBRANCH ? escapeHtml(env.BUILD_SOURCEBRANCH.replace(/^refs\/heads\//, '')) : '',
    env.BUILD_SOURCEVERSION ? `commit ${escapeHtml(String(env.BUILD_SOURCEVERSION).slice(0, 8))}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const tableControls = (prefix: string) => `
    <div class="table-controls">
      <input type="search" id="${prefix}Search" placeholder="Search…" />
      <select id="${prefix}Filter">
        <option value="all">All</option>
        <option value="failed">Failed</option>
        <option value="passed">Passed</option>
      </select>
      <span class="meta" id="${prefix}Count"></span>
      <button type="button" class="linkish" data-load="${prefix}">Load more</button>
    </div>`;

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
    th { background: #f8fafc; position: sticky; top: 0; z-index: 1; }
    .table-scroll { overflow: auto; max-height: 520px; }
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
    details.card { padding: 0; }
    details.card > summary {
      list-style: none; cursor: pointer; padding: 16px 20px; display: flex; align-items: center; gap: 10px;
      user-select: none; border-bottom: 1px solid transparent;
    }
    details.card[open] > summary { border-bottom-color: var(--border); }
    details.card > summary::-webkit-details-marker { display: none; }
    details.card > summary .chevron::before { content: '▶'; font-size: 0.75rem; color: var(--muted); }
    details.card[open] > summary .chevron::before { content: '▼'; }
    details.card > summary h2 { margin: 0; flex: 1; font-size: 1.1rem; }
    details.card .body { padding: 0 20px 20px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; }
    .toolbar button, .table-controls button, .table-controls select, .table-controls input {
      border: 1px solid var(--border); background: #fff; border-radius: 8px; padding: 8px 12px; font: inherit; cursor: pointer;
    }
    .table-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
    .table-controls input { min-width: 180px; }
    .linkish { color: #1d4ed8; }
    tr[data-hidden="1"] { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <section class="header">
      <h1>TaxMesh Pact Test Report</h1>
      <p class="meta">Generated at ${escapeHtml(report.generatedAt)} · Pattern: ContractTestDemo / EY_Demo${buildMeta ? ` · ${buildMeta}` : ''}</p>
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
      <div class="toolbar">
        <button type="button" id="expandAllBtn">Expand all</button>
        <button type="button" id="collapseAllBtn">Collapse all</button>
      </div>
    </section>

    ${buildPhaseCards(report)}

    <details class="card service-map-card" open>
      <summary><span class="chevron"></span><h2>Microservice map</h2></summary>
      <div class="body">
        <p class="meta">Live contract-test status across TaxMesh services (CLM → DOC + Gateway). Green = OK, red = failure.</p>
        <div class="service-map-wrap">${svg}</div>
      </div>
    </details>

    ${
      highlightRows
        ? `<details class="card" open>
      <summary><span class="chevron"></span><h2>Failure highlights</h2>${statusBadge('failed')}</summary>
      <div class="body">
      <p class="meta">Endpoint, expected, and actual values for failed tests.</p>
      <table>
        <thead><tr><th>Phase</th><th>Endpoint</th><th>Test / interaction</th><th>Expected</th><th>Actual</th></tr></thead>
        <tbody>${highlightRows}</tbody>
      </table>
      </div>
    </details>`
        : ''
    }

    <details class="card"${consumerOpen}>
      <summary><span class="chevron"></span><h2>Consumer Contract Tests</h2>${statusBadge(report.consumer.status)} <span class="meta">${report.consumer.passed}/${report.consumer.total}</span></summary>
      <div class="body">
      <p class="meta">Step 1 — ${escapeHtml(report.consumer.label)}</p>
      ${tableControls('consumer')}
      <div class="table-scroll">
      <table id="consumerTable">
        <thead><tr><th>Endpoint</th><th>Test</th><th>Suite</th><th>Status</th><th>Reason</th><th>Duration</th></tr></thead>
        <tbody>${consumerRows || '<tr><td colspan="6">No consumer test results available.</td></tr>'}</tbody>
      </table>
      </div>
      ${buildFailureBlocks(report.consumer.failures, 'Consumer failure details')}
      </div>
    </details>

    <details class="card"${providerOpen}>
      <summary><span class="chevron"></span><h2>Provider Verification</h2>${statusBadge(report.provider.status)} <span class="meta">${report.provider.passed}/${report.provider.total}</span></summary>
      <div class="body">
      <p class="meta">Step 2 — ${escapeHtml(report.provider.label)}</p>
      ${tableControls('provider')}
      <div class="table-scroll">
      <table id="providerTable">
        <thead><tr><th>Endpoint</th><th>Interaction</th><th>Status</th><th>Expected</th><th>Actual</th><th>Duration</th></tr></thead>
        <tbody>${providerTableBody}</tbody>
      </table>
      </div>
      ${buildFailureBlocks(report.provider.failures, 'Provider failure details')}
      </div>
    </details>

    <details class="card">
      <summary><span class="chevron"></span><h2>Artifacts</h2></summary>
      <div class="body">
      <ul>
        <li>JSON report: <code>reports/pact-report.json</code></li>
        <li>HTML report: <code>reports/pact-report.html</code></li>
        <li>Excel report: <code>reports/TaxMesh-Contract-Report.xlsx</code></li>
        <li>Interactive map: <code>reports/interactive-service-map.html</code></li>
        <li>Dashboard zip: <code>reports/TaxMesh-Contract-Dashboard.zip</code></li>
        <li>Pact files: ${report.pactFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ') || 'None'}</li>
      </ul>
      </div>
    </details>
  </div>
  <script>
    (function () {
      const PAGE = 50;
      const state = { consumer: PAGE, provider: PAGE };
      function apply(prefix) {
        const table = document.getElementById(prefix + 'Table');
        if (!table) return;
        const rows = Array.from(table.tBodies[0]?.rows || []);
        const filter = document.getElementById(prefix + 'Filter')?.value || 'all';
        const q = (document.getElementById(prefix + 'Search')?.value || '').toLowerCase().trim();
        let matched = 0;
        let shown = 0;
        for (const row of rows) {
          const status = row.getAttribute('data-status') || '';
          const text = row.getAttribute('data-text') || '';
          const okStatus = filter === 'all' || status === filter;
          const okSearch = !q || text.includes(q);
          const match = okStatus && okSearch;
          if (match) matched += 1;
          const visible = match && matched <= state[prefix];
          if (visible) shown += 1;
          row.setAttribute('data-hidden', visible ? '0' : '1');
        }
        const count = document.getElementById(prefix + 'Count');
        if (count) count.textContent = 'Showing ' + shown + ' of ' + matched;
      }
      ['consumer', 'provider'].forEach((prefix) => {
        document.getElementById(prefix + 'Search')?.addEventListener('input', () => { state[prefix] = PAGE; apply(prefix); });
        document.getElementById(prefix + 'Filter')?.addEventListener('change', () => { state[prefix] = PAGE; apply(prefix); });
        apply(prefix);
      });
      document.querySelectorAll('[data-load]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const prefix = btn.getAttribute('data-load');
          state[prefix] += PAGE;
          apply(prefix);
        });
      });
      document.getElementById('expandAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('details.card').forEach((d) => { d.open = true; });
      });
      document.getElementById('collapseAllBtn')?.addEventListener('click', () => {
        document.querySelectorAll('details.card').forEach((d) => { d.open = false; });
      });
    })();
  </script>
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

  const pactsDir = config.pactsDir;
  const consumer = enrichPhaseEndpoints(input.consumer, pactsDir);
  const provider = enrichPhaseEndpoints(input.provider, pactsDir);
  const serviceMap = buildTaxMeshServiceMap(consumer, provider);

  return normalizeReportMismatches(
    attachCoverage({
      generatedAt: new Date().toISOString(),
      project: 'TaxMesh Pact Contract Tests',
      overallStatus,
      consumer,
      provider,
      pactFiles: input.pactFiles,
      serviceMap,
      phases: {
        consumer: {
          ran: consumer.ran,
          status: consumer.status,
          passed: consumer.passed,
          total: consumer.total,
          failed: consumer.failed,
          label: consumer.label,
        },
        provider: {
          ran: provider.ran,
          status: provider.status,
          passed: provider.passed,
          total: provider.total,
          failed: provider.failed,
          label: provider.label,
          providerBaseUrl: provider.providerBaseUrl,
        },
      },
      environment: input.environment || {},
    })
  );
}

export async function writeReports(report: PactReport): Promise<{
  jsonPath: string;
  htmlPath: string;
  interactivePath: string;
  dashboardZipPath: string;
  excelPath: string;
}> {
  const dir = ensureReportsDir();
  const jsonPath = path.join(dir, 'pact-report.json');
  const latestPath = path.join(dir, 'latest.json');
  const htmlPath = path.join(dir, 'pact-report.html');
  const interactivePath = path.join(dir, 'interactive-service-map.html');
  const excelPathDefault = path.join(dir, 'TaxMesh-Contract-Report.xlsx');

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

  let excelPath = '';
  try {
    excelPath = await writeExcelReport(report, excelPathDefault);
  } catch (error: any) {
    const fallback = path.join(
      dir,
      `TaxMesh-Contract-Report-${Date.now()}.xlsx`
    );
    try {
      excelPath = await writeExcelReport(report, fallback);
      console.warn(
        `Excel primary path locked (${error.message}); wrote fallback: ${fallback}`
      );
    } catch (fallbackError: any) {
      console.warn(`Failed to write Excel report: ${fallbackError.message}`);
    }
  }
  if (excelPath) {
    try {
      fs.copyFileSync(excelPath, path.join(dashboardDataDir, 'TaxMesh-Contract-Report.xlsx'));
    } catch (copyError: any) {
      console.warn(`Could not copy Excel into dashboard/data: ${copyError.message}`);
    }
    console.log(`Excel report: ${excelPath}`);
  }

  let dashboardZipPath = '';
  try {
    dashboardZipPath = packInteractiveDashboardZip(report, { excelPath: excelPath || undefined });
    console.log(`Interactive dashboard zip: ${dashboardZipPath}`);
  } catch (error: any) {
    console.warn(`Failed to package interactive dashboard zip: ${error.message}`);
  }

  return { jsonPath, htmlPath, interactivePath, dashboardZipPath, excelPath };
}
