/**
 * Fold provider-verify failures into coverage as **mismatch** (updates).
 * New APIs with no contract stay **missing** (handled in coverageAudit).
 */
import { CONTRACTS } from '../catalog/contracts';
import type { CoverageReport, CoverageRow } from './coverageAudit';

export interface ProviderGap {
  method: string;
  path: string;
  note?: string;
  operation?: string;
  service?: string;
}

function opKey(method: string, p: string): string {
  return `${method.toUpperCase()} ${p}`;
}

function pathTemplateRegex(openapiPath: string): RegExp {
  const escaped = openapiPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

function svcFromProviderName(name?: string): string | undefined {
  if (!name) return undefined;
  const m = name.match(/TaxMesh-(CLM|MDM|ACC|TAX|ALC|DOC|Gateway)/i);
  return m?.[1]?.toUpperCase();
}

/** Candidate concrete/swagger paths for a provider gap. */
export function gapPathCandidates(gap: ProviderGap): string[] {
  const p = gap.path.startsWith('/') ? gap.path : `/${gap.path}`;
  const out = new Set<string>([p]);
  const op = gap.operation || '';

  const against = op.match(/\bagainst\s+(CLM|MDM|ACC|TAX|ALC|DOC)\b/i);
  let svc =
    gap.service ||
    svcFromProviderName(op) ||
    against?.[1]?.toUpperCase();

  const ctByPath = CONTRACTS.find((c) => c.path === p);
  if (ctByPath) {
    svc = ctByPath.producer;
    out.add(`/api/proxy/${ctByPath.producer}${p}`);
  }

  const peer = p.match(/^\/(downstream|upstream)\/([A-Z]+)$/i);
  if (peer) {
    const peerId = peer[2].toUpperCase();
    const edge = CONTRACTS.find(
      (c) =>
        c.consumer === peerId &&
        (peer[1].toLowerCase() === 'downstream'
          ? c.direction === 'downstream'
          : c.direction === 'reverse')
    );
    if (edge) {
      svc = edge.producer;
      out.add(`/api/proxy/${edge.producer}${p}`);
    }
  }

  const consume = p.match(/^\/consume\/(CT-\d+)$/i);
  if (consume) {
    if (/against\s+CLM/i.test(op)) out.add(`/api/proxy/CLM${p}`);
    if (/against\s+MDM/i.test(op)) out.add(`/api/proxy/MDM${p}`);
    const ct = CONTRACTS.find(
      (c) => c.id.toUpperCase() === consume[1].toUpperCase()
    );
    if (ct) out.add(`/api/proxy/${ct.consumer}${p}`);
  }

  if (svc && svc !== 'GATEWAY' && !p.startsWith('/api/')) {
    out.add(`/api/proxy/${svc}${p}`);
  }

  return [...out];
}

function findRowIndex(rows: CoverageRow[], method: string, candidates: string[]): number {
  const m = method.toUpperCase();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.method !== m) continue;
    for (const c of candidates) {
      if (row.path === c) return i;
      if (pathTemplateRegex(row.path).test(c)) return i;
    }
  }
  return -1;
}

/**
 * Provider gaps → **mismatch** (existing contract needs update).
 * Does not move true missing/new rows into mismatch unless they match a gap.
 */
export function applyProviderGapsToCoverage(
  report: CoverageReport,
  gaps: ProviderGap[]
): CoverageReport {
  if (!gaps.length) return report;

  const rows: CoverageRow[] = report.rows.map((r) => ({ ...r }));
  const mismatchByKey = new Map<string, CoverageRow>();

  for (const g of report.mismatches || []) {
    mismatchByKey.set(opKey(g.method, g.path), { ...g });
  }

  for (const gap of gaps) {
    const method = (gap.method || 'GET').toUpperCase();
    const candidates = gapPathCandidates(gap);
    const idx = findRowIndex(rows, method, candidates);
    const note =
      gap.note ||
      gap.operation ||
      'Provider verify failed (BodyMismatch/StatusMismatch)';

    if (idx >= 0) {
      const row = rows[idx];
      const mismatchRow: CoverageRow = {
        ...row,
        status: 'mismatch',
        note: `Update/mismatch: ${note}`,
        evidence: [
          ...(row.evidence || []),
          `provider-gap:${method} ${gap.path}`,
        ],
      };
      rows[idx] = mismatchRow;
      mismatchByKey.set(opKey(row.method, row.path), mismatchRow);
    } else {
      const swaggerPath =
        candidates.find((c) => c.startsWith('/api/proxy/')) || candidates[0];
      const mismatchRow: CoverageRow = {
        method,
        path: swaggerPath,
        status: 'mismatch',
        evidence: [`provider-gap:${method} ${gap.path}`],
        note: `Update/mismatch (no exact OpenAPI row): ${note}`,
      };
      mismatchByKey.set(opKey(method, swaggerPath), mismatchRow);
    }
  }

  const mismatches = [...mismatchByKey.values()];
  const mismatchKeys = new Set(mismatches.map((r) => opKey(r.method, r.path)));

  const missing = rows.filter(
    (r) => r.status === 'missing' && !mismatchKeys.has(opKey(r.method, r.path))
  );
  const deferred = rows.filter((r) => r.status === 'deferred');
  const partial = rows.filter((r) => r.status === 'partial').length;
  const covered = rows.filter(
    (r) =>
      r.status === 'covered' && !mismatchKeys.has(opKey(r.method, r.path))
  ).length;

  for (let i = 0; i < rows.length; i++) {
    if (mismatchKeys.has(opKey(rows[i].method, rows[i].path))) {
      rows[i] = { ...rows[i], status: 'mismatch' };
    }
  }

  return {
    ...report,
    generatedAt: new Date().toISOString(),
    totals: {
      ops: report.totals.ops,
      covered,
      partial,
      missing: missing.length,
      mismatch: mismatches.length,
      deferred: deferred.length,
    },
    rows,
    missing,
    mismatches,
    deferred,
  };
}

export function loadProviderGapsFromPactReport(
  pactReport: unknown
): ProviderGap[] {
  const gaps = (pactReport as any)?.coverage?.gaps?.provider;
  if (!Array.isArray(gaps)) return [];
  return gaps.map((g: any) => ({
    method: String(g.method || 'GET'),
    path: String(g.path || ''),
    note: g.note ? String(g.note) : undefined,
    operation: g.operation ? String(g.operation) : undefined,
  }));
}
