import fs from 'fs';
import path from 'path';
import { CONTRACTS, SERVICES, type ContractDef, type ServiceId } from '../catalog/contracts';
import { readableMismatchNote } from './mismatchFormat';
import type { PactReport, PhaseStatus } from './types';

export type CtGraphStatus = 'pass' | 'fail' | 'skipped';

export interface CtGraphInteraction {
  status: CtGraphStatus;
  kind: 'consumer' | 'provider';
  name: string;
  durationMs: number;
}

export interface CtGraphResult {
  status: CtGraphStatus;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  lastRun: string | null;
  errorMessage: string | null;
  expected: string | null;
  actual: string | null;
  history: CtGraphStatus[];
  interactions: CtGraphInteraction[];
}

export interface CtGraphTopologyEdge {
  id: string;
  from: string;
  to: string;
  type: 'solid' | 'dotted';
  path: string;
  title: string;
}

export interface CtGraphPayload {
  generatedAt: string;
  overallStatus: PhaseStatus;
  topology: CtGraphTopologyEdge[];
  serviceMeta: Record<string, { name: string }>;
  results: Record<string, CtGraphResult>;
}

function phaseToGraphStatus(status: string | undefined): CtGraphStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'passed' || s === 'pass') return 'pass';
  if (s === 'failed' || s === 'fail' || s === 'error') return 'fail';
  return 'skipped';
}

function extractCtId(text: string): string | null {
  const m =
    String(text || '').match(/\bCT-(\d{2})\b/i) ||
    String(text || '').match(/\/contracts\/ct-(\d{2})\b/i) ||
    String(text || '').match(/\/consume\/CT-(\d{2})\b/i);
  return m ? `CT-${m[1]}` : null;
}

function matchesContract(ct: ContractDef, blob: string): boolean {
  const id = extractCtId(blob);
  if (id === ct.id) return true;
  const lower = blob.toLowerCase();
  if (ct.path && lower.includes(ct.path.toLowerCase())) return true;
  const leaf = ct.path.split('/').filter(Boolean).pop();
  if (leaf && lower.includes(leaf.toLowerCase()) && lower.includes(ct.id.toLowerCase())) {
    return true;
  }
  return false;
}

function isProducePathHit(ct: ContractDef, blob: string): boolean {
  const lower = blob.toLowerCase();
  if (lower.includes(ct.path.toLowerCase())) return true;
  if (new RegExp(`${ct.id}\\s+produce`, 'i').test(blob)) return true;
  if (lower.includes('/consume/')) return false;
  return matchesContract(ct, blob);
}

export function buildCtTopology(): CtGraphTopologyEdge[] {
  return CONTRACTS.map((ct) => ({
    id: ct.id,
    from: ct.producer,
    to: ct.consumer,
    type: ct.direction === 'reverse' ? 'dotted' : 'solid',
    path: ct.path,
    title: ct.title,
  }));
}

export function buildServiceMeta(): Record<string, { name: string }> {
  const meta: Record<string, { name: string }> = {};
  for (const id of Object.keys(SERVICES) as ServiceId[]) {
    meta[id] = { name: SERVICES[id].name };
  }
  return meta;
}

function collectConsumerHits(
  report: PactReport,
  ct: ContractDef
): CtGraphInteraction[] {
  const rows: CtGraphInteraction[] = [];
  const tests = report.consumer?.tests || [];
  for (const t of tests) {
    const blob = `${t.suite || ''} ${t.name || ''} ${t.endpoint || ''}`;
    if (!matchesContract(ct, blob)) continue;
    // Prefer produce-path / direct CT rows; skip pure peer noise when name has no CT
    if (!isProducePathHit(ct, blob) && !extractCtId(blob)) continue;
    rows.push({
      status: phaseToGraphStatus(t.status),
      kind: 'consumer',
      name: t.name || t.endpoint || `${ct.id} consumer`,
      durationMs: Number(t.durationMs) || 0,
    });
  }

  const interactions = report.consumer?.interactions || [];
  for (const ix of interactions) {
    const blob = `${ix.description || ''} ${ix.endpoint || ''} ${ix.path || ''}`;
    if (!matchesContract(ct, blob)) continue;
    if (!isProducePathHit(ct, blob) && !/produce/i.test(blob)) continue;
    rows.push({
      status: phaseToGraphStatus(ix.status),
      kind: 'consumer',
      name: ix.description || ix.endpoint || `${ct.id} consumer`,
      durationMs: Number(ix.durationMs) || 0,
    });
  }
  return rows;
}

function collectProviderHits(
  report: PactReport,
  ct: ContractDef
): Array<CtGraphInteraction & { expected?: string; actual?: string; reason?: string }> {
  const rows: Array<
    CtGraphInteraction & { expected?: string; actual?: string; reason?: string }
  > = [];
  const interactions = report.provider?.interactions || [];
  for (const ix of interactions) {
    const blob = `${ix.description || ''} ${ix.endpoint || ''} ${ix.path || ''}`;
    if (/\/consume\//i.test(blob)) continue; // produce edges only
    const pathNorm = String(ix.path || ix.endpoint || '')
      .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, '')
      .replace(/\/$/, '');
    const pathHit =
      pathNorm === ct.path ||
      pathNorm.endsWith(ct.path) ||
      pathNorm.includes(ct.path);
    const descHit =
      new RegExp(`\\b${ct.id}\\b`, 'i').test(ix.description || '') &&
      /\/contracts\/ct-\d{2}/i.test(blob);
    if (!pathHit && !descHit) continue;
    rows.push({
      status: phaseToGraphStatus(ix.status),
      kind: 'provider',
      name: ix.description || ix.endpoint || `${ct.id} provider`,
      durationMs: Number(ix.durationMs) || 0,
      expected: ix.expected,
      actual: ix.actual,
      reason: ix.reason,
    });
  }

  for (const failure of report.provider?.failures || []) {
    const blob = `${failure.interaction || ''} ${failure.endpoint || ''} ${failure.test || ''}`;
    if (!matchesContract(ct, blob)) continue;
    if (/\/consume\//i.test(blob)) continue;
    const already = rows.some((r) => r.name === (failure.interaction || failure.endpoint));
    if (already) continue;
    rows.push({
      status: 'fail',
      kind: 'provider',
      name: failure.interaction || failure.endpoint || `${ct.id} provider failure`,
      durationMs: 0,
      expected: failure.expected,
      actual: failure.actual,
      reason: failure.reason,
    });
  }
  return rows;
}

function aggregateCtResult(
  ct: ContractDef,
  consumerHits: CtGraphInteraction[],
  providerHits: Array<
    CtGraphInteraction & { expected?: string; actual?: string; reason?: string }
  >,
  generatedAt: string
): CtGraphResult {
  // Deduplicate by kind+name
  const seen = new Set<string>();
  const interactions: CtGraphInteraction[] = [];
  for (const row of [...consumerHits, ...providerHits]) {
    const key = `${row.kind}:${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    interactions.push({
      status: row.status,
      kind: row.kind,
      name: row.name,
      durationMs: row.durationMs,
    });
  }

  const total = interactions.length;
  const passed = interactions.filter((i) => i.status === 'pass').length;
  const failed = interactions.filter((i) => i.status === 'fail').length;
  const durationMs = interactions.reduce((sum, i) => sum + (i.durationMs || 0), 0);

  let status: CtGraphStatus = 'skipped';
  if (failed > 0) status = 'fail';
  else if (total > 0 && passed === total) status = 'pass';
  else if (passed > 0 && failed === 0) status = 'pass';
  else if (total === 0) status = 'skipped';

  const failRow = providerHits.find((r) => r.status === 'fail') ||
    consumerHits.find((r) => r.status === 'fail');
  let expected: string | null = null;
  let actual: string | null = null;
  let errorMessage: string | null = null;
  if (failRow && 'expected' in failRow) {
    expected = failRow.expected || null;
    actual = failRow.actual || null;
    const note = readableMismatchNote(
      failRow.reason ||
        (expected && actual ? `${expected} → ${actual}` : actual || expected || '') ||
        '',
      'Verification failed'
    );
    errorMessage = note;
  } else if (status === 'skipped') {
    errorMessage = `No consumer/provider produce-path evidence for ${ct.id} in this run`;
  }

  return {
    status,
    total,
    passed,
    failed,
    durationMs,
    lastRun: generatedAt || null,
    errorMessage,
    expected,
    actual,
    history: [status],
    interactions,
  };
}

export function buildCtGraphPayload(report: PactReport): CtGraphPayload {
  const generatedAt = report.generatedAt || new Date().toISOString();
  const results: Record<string, CtGraphResult> = {};
  for (const ct of CONTRACTS) {
    const consumerHits = collectConsumerHits(report, ct);
    const providerHits = collectProviderHits(report, ct);
    results[ct.id] = aggregateCtResult(ct, consumerHits, providerHits, generatedAt);
  }
  return {
    generatedAt,
    overallStatus: report.overallStatus,
    topology: buildCtTopology(),
    serviceMeta: buildServiceMeta(),
    results,
  };
}

function encodePayload(payload: CtGraphPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function templatePath(): string {
  return path.join(__dirname, 'templates', 'contract-dependency-graph.html');
}

/** Build offline HTML with live CT results injected as window.__CT_GRAPH__. */
export function buildContractDependencyGraphHtml(report: PactReport): string {
  const tplPath = templatePath();
  if (!fs.existsSync(tplPath)) {
    throw new Error(`Missing dependency graph template: ${tplPath}`);
  }
  const template = fs.readFileSync(tplPath, 'utf8');
  const payload = buildCtGraphPayload(report);
  const encoded = encodePayload(payload);
  const bootstrap = `<script id="ct-graph-data" type="text/plain" data-encoding="base64">${encoded}</script>
<script>window.__CT_GRAPH__=JSON.parse(atob(document.getElementById('ct-graph-data').textContent.trim()));</script>
`;
  if (/<script>\s*\(function\s*\(\)\s*\{/.test(template)) {
    return template.replace(
      /<script>\s*\(function\s*\(\)\s*\{/,
      `${bootstrap}<script>\n(function () {`
    );
  }
  return template.replace(/<\/body>/i, `${bootstrap}</body>`);
}

export function writeContractDependencyGraph(
  report: PactReport,
  outputPath: string
): string {
  const html = buildContractDependencyGraphHtml(report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}
