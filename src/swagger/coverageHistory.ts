/**
 * Slim coverage history for DiffAuditor token optimization.
 * Stores totals + gap keys only (not full covered row lists).
 */
import fs from 'fs';
import path from 'path';
import type { CoverageReport, CoverageRow } from './coverageAudit';

export interface CoverageHistoryEntry {
  at: string;
  source: string;
  totals: CoverageReport['totals'];
  missingKeys: string[];
  mismatchKeys: string[];
  deferredKeys: string[];
  /** Keys that appeared vs previous entry (new gaps). */
  deltaVsPrevious?: {
    missingAdded: string[];
    missingRemoved: string[];
    mismatchAdded: string[];
    mismatchRemoved: string[];
  };
}

const DEFAULT_HISTORY = 'reports/swagger-coverage-history.jsonl';
const MAX_ENTRIES = 40;

function rowKey(r: Pick<CoverageRow, 'method' | 'path'>): string {
  return `${r.method} ${r.path}`;
}

export function historyPath(cwd = process.cwd()): string {
  return path.resolve(cwd, DEFAULT_HISTORY);
}

export function readHistory(cwd = process.cwd()): CoverageHistoryEntry[] {
  const file = historyPath(cwd);
  if (!fs.existsSync(file)) return [];
  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: CoverageHistoryEntry[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as CoverageHistoryEntry);
    } catch {
      // skip corrupt line
    }
  }
  return out;
}

export function latestHistory(cwd = process.cwd()): CoverageHistoryEntry | null {
  const all = readHistory(cwd);
  return all.length ? all[all.length - 1] : null;
}

function diffKeys(prev: string[] | undefined, next: string[]) {
  const p = new Set(prev || []);
  const n = new Set(next);
  return {
    added: next.filter((k) => !p.has(k)),
    removed: [...p].filter((k) => !n.has(k)),
  };
}

/** Build + append one slim history line; returns the entry written. */
export function appendCoverageHistory(
  report: CoverageReport,
  cwd = process.cwd()
): CoverageHistoryEntry {
  const prev = latestHistory(cwd);
  const missingKeys = report.missing.map(rowKey);
  const mismatchKeys = (report.mismatches || []).map(rowKey);
  const deferredKeys = report.deferred.map(rowKey);

  const miss = diffKeys(prev?.missingKeys, missingKeys);
  const mis = diffKeys(prev?.mismatchKeys, mismatchKeys);

  const entry: CoverageHistoryEntry = {
    at: report.generatedAt || new Date().toISOString(),
    source: report.source,
    totals: { ...report.totals },
    missingKeys,
    mismatchKeys,
    deferredKeys,
    deltaVsPrevious: prev
      ? {
          missingAdded: miss.added,
          missingRemoved: miss.removed,
          mismatchAdded: mis.added,
          mismatchRemoved: mis.removed,
        }
      : undefined,
  };

  const file = historyPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let existing = readHistory(cwd);
  existing.push(entry);
  if (existing.length > MAX_ENTRIES) {
    existing = existing.slice(-MAX_ENTRIES);
  }
  fs.writeFileSync(
    file,
    existing.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf8'
  );

  // Latest pointer for agents (tiny JSON, prefer over full coverage rows)
  fs.writeFileSync(
    path.resolve(cwd, 'reports/swagger-coverage-latest-slim.json'),
    JSON.stringify(entry, null, 2),
    'utf8'
  );

  return entry;
}
