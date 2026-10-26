import fs from 'fs';
import path from 'path';
import { CONTRACTS, SERVICES, type ServiceId } from '../catalog/contracts';
import type {
  InteractionResult,
  PactReport,
  PhaseStatus,
  PhaseSummary,
} from './types';

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

export function summarizeConsumerFromJest(jestResults: any | null): PhaseSummary {
  const interactions: InteractionResult[] = [];
  if (!jestResults) {
    return {
      status: 'unknown',
      total: 0,
      passed: 0,
      failed: 0,
      durationMs: 0,
      label: 'Consumer contract tests (Jest + Pact mock)',
      interactions,
      ran: false,
    };
  }

  for (const suite of jestResults.testResults || []) {
    for (const test of suite.assertionResults || []) {
      const failed = test.status === 'failed';
      interactions.push({
        description: test.fullName || test.title,
        provider: 'mock',
        status: failed ? 'failed' : test.status === 'passed' ? 'passed' : 'unknown',
        durationMs: test.duration || 0,
        reason: failed
          ? (test.failureMessages || []).join('\n').slice(0, 500)
          : undefined,
      });
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
    label: 'Consumer contract tests (Jest + Pact mock)',
    interactions,
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
  let passed = 0;
  let failed = 0;
  let durationMs = 0;

  for (const block of providerBlocks) {
    durationMs += block.durationMs || 0;
    const results = block.interactionResults || [];
    if (results.length === 0 && !block.success) {
      failed += 1;
      interactions.push({
        description: `${block.provider} verification`,
        provider: block.provider,
        status: 'failed',
        reason: JSON.stringify(block.errors || []).slice(0, 500),
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
      interactions.push({
        description: r.description,
        provider: block.provider,
        status: ok ? 'passed' : 'failed',
        durationMs: r.duration ? Number(String(r.duration).replace(/ms/, '')) || 0 : 0,
        reason: err ? JSON.stringify(err.mismatch || err).slice(0, 500) : undefined,
      });
    }
  }

  const total = passed + failed;
  return {
    status: statusFromCounts(passed, failed, providerBlocks.length > 0),
    total,
    passed,
    failed,
    durationMs,
    label: 'Provider verification (live TaxMesh services)',
    interactions,
    ran: providerBlocks.length > 0,
  };
}

function buildServiceMap(consumer: PhaseSummary, provider: PhaseSummary) {
  const nodeStats: Record<
    string,
    { passed: number; failed: number; total: number }
  > = {};

  for (const id of Object.keys(SERVICES) as ServiceId[]) {
    nodeStats[id] = { passed: 0, failed: 0, total: 0 };
  }
  nodeStats.Gateway = { passed: 0, failed: 0, total: 0 };

  for (const ix of provider.interactions) {
    const key = ix.provider.replace(/^TaxMesh-/, '');
    if (!nodeStats[key]) nodeStats[key] = { passed: 0, failed: 0, total: 0 };
    nodeStats[key].total += 1;
    if (ix.status === 'passed') nodeStats[key].passed += 1;
    if (ix.status === 'failed') nodeStats[key].failed += 1;
  }

  // Attribute consumer activity to overall map (mock phase)
  if (consumer.ran) {
    nodeStats.Client = {
      passed: consumer.passed,
      failed: consumer.failed,
      total: consumer.total,
    };
  }

  const nodes = Object.entries(nodeStats).map(([id, s]) => ({
    id,
    label: id === 'Gateway' ? 'Gateway' : id === 'Client' ? 'TaxMesh-Client' : `TaxMesh-${id}`,
    status: statusFromCounts(s.passed, s.failed, s.total > 0),
    ...s,
  }));

  const edges = CONTRACTS.map((c) => ({
    from: c.producer,
    to: c.consumer,
    id: c.id,
  }));

  return { nodes, edges };
}

export function buildReport(input: {
  consumer: PhaseSummary;
  provider: PhaseSummary;
  pactFiles: string[];
  environment?: Record<string, string>;
}): PactReport {
  const overallFailed = input.consumer.failed + input.provider.failed;
  const overallPassed = input.consumer.passed + input.provider.passed;
  const overallStatus: PhaseStatus =
    !input.consumer.ran && !input.provider.ran
      ? 'unknown'
      : overallFailed > 0
        ? 'failed'
        : overallPassed > 0
          ? 'passed'
          : 'unknown';

  return {
    generatedAt: new Date().toISOString(),
    project: 'TaxMesh Pact Contract Tests',
    overallStatus,
    consumer: input.consumer,
    provider: input.provider,
    pactFiles: input.pactFiles,
    serviceMap: buildServiceMap(input.consumer, input.provider),
    environment: input.environment || {},
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badge(status: PhaseStatus): string {
  const color =
    status === 'passed' ? '#15803d' : status === 'failed' ? '#b91c1c' : '#a16207';
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;color:${color};background:${color}1a">${status.toUpperCase()}</span>`;
}

export function renderHtmlReport(report: PactReport): string {
  const c = report.consumer;
  const p = report.provider;
  const edgeRows = report.serviceMap.edges
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.id)}</td><td>${escapeHtml(e.from)}</td><td>${escapeHtml(e.to)}</td></tr>`
    )
    .join('');

  const nodeCards = report.serviceMap.nodes
    .filter((n) => n.total > 0 || ['CLM', 'MDM', 'ACC', 'TAX', 'ALC', 'DOC', 'Gateway', 'Client'].includes(n.id))
    .map(
      (n) => `
      <div class="card node">
        <div class="node-title">${escapeHtml(n.label)} ${badge(n.status)}</div>
        <div class="meta">${n.passed}/${n.total} passed · ${n.failed} failed</div>
      </div>`
    )
    .join('');

  const failRows = [...c.interactions, ...p.interactions]
    .filter((i) => i.status === 'failed')
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.provider)}</td>
        <td>${escapeHtml(i.description)}</td>
        <td><pre>${escapeHtml(i.reason || '')}</pre></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TaxMesh Pact Report — ${escapeHtml(report.overallStatus)}</title>
  <style>
    :root { --bg:#0b1220; --card:#121a2b; --line:#243049; --text:#e5eefc; --muted:#9db0d0; --accent:#5b8cff; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Segoe UI,system-ui,sans-serif; background:radial-gradient(1200px 600px at 10% -10%,#1a2b4d,transparent),var(--bg); color:var(--text); }
    .wrap { max-width:1100px; margin:0 auto; padding:28px 20px 60px; }
    h1 { margin:0 0 8px; font-size:1.75rem; }
    .meta { color:var(--muted); margin-bottom:20px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin:18px 0 28px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
    .kpi { font-size:1.8rem; font-weight:700; }
    .label { color:var(--muted); font-size:0.85rem; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; font-size:0.9rem; }
    th, td { border-bottom:1px solid var(--line); padding:10px 8px; text-align:left; vertical-align:top; }
    th { color:var(--muted); font-weight:600; }
    pre { white-space:pre-wrap; margin:0; font-size:0.78rem; color:#fca5a5; }
    .section { margin-top:28px; }
    .flow { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:12px 0 8px; font-weight:600; }
    .pill { background:#1e293b; border:1px solid var(--line); padding:6px 10px; border-radius:999px; }
    .arrow { color:var(--accent); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>TaxMesh Pact Contract Report</h1>
    <p class="meta">Generated ${escapeHtml(report.generatedAt)} · Overall ${badge(report.overallStatus)}</p>

    <div class="flow">
      <span class="pill">CLM</span><span class="arrow">→</span>
      <span class="pill">MDM</span><span class="arrow">→</span>
      <span class="pill">ACC</span><span class="arrow">→</span>
      <span class="pill">TAX</span><span class="arrow">→</span>
      <span class="pill">ALC</span><span class="arrow">→</span>
      <span class="pill">DOC</span>
      <span class="pill">+ Gateway</span>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Consumer</div><div class="kpi">${c.passed}/${c.total}</div>${badge(c.status)}<div class="meta">${escapeHtml(c.label)}</div></div>
      <div class="card"><div class="label">Provider</div><div class="kpi">${p.passed}/${p.total}</div>${badge(p.status)}<div class="meta">${escapeHtml(p.label)}</div></div>
      <div class="card"><div class="label">Pact files</div><div class="kpi">${report.pactFiles.length}</div><div class="meta">${report.pactFiles.map(escapeHtml).join('<br/>') || '—'}</div></div>
    </div>

    <div class="section">
      <h2>Service map</h2>
      <div class="grid">${nodeCards}</div>
    </div>

    <div class="section">
      <h2>CT-00…CT-17 edges</h2>
      <div class="card">
        <table>
          <thead><tr><th>Contract</th><th>Producer</th><th>Consumer</th></tr></thead>
          <tbody>${edgeRows}</tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Failures</h2>
      <div class="card">
        ${
          failRows
            ? `<table><thead><tr><th>Provider</th><th>Interaction</th><th>Reason</th></tr></thead><tbody>${failRows}</tbody></table>`
            : '<p class="meta">No failures 🎉</p>'
        }
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function writeReports(report: PactReport): { jsonPath: string; htmlPath: string } {
  const dir = ensureReportsDir();
  const jsonPath = path.join(dir, 'latest.json');
  const htmlPath = path.join(dir, 'pact-report.html');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(htmlPath, renderHtmlReport(report), 'utf8');
  return { jsonPath, htmlPath };
}
