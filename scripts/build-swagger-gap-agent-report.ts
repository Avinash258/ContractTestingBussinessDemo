/**
 * Merge gaps-before.json + gaps-after.json + agent summary into
 * reports/SWAGGER_GAP_AGENT_REPORT.md
 *
 *   npx ts-node --transpile-only scripts/build-swagger-gap-agent-report.ts
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BEFORE = path.join(ROOT, 'reports/gaps-before.json');
const AFTER = path.join(ROOT, 'reports/gaps-after.json');
const SUMMARY = path.join(ROOT, 'reports/swagger-gap-agent-summary.json');
const OUT = path.join(ROOT, 'reports/SWAGGER_GAP_AGENT_REPORT.md');
const REEXEC = path.join(ROOT, 'reports/swagger-gap-reexec.json');

function loadJson(p: string): any {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function missingKeys(cov: any): string[] {
  if (!cov) return [];
  const rows = Array.isArray(cov.missing)
    ? cov.missing
    : (cov.rows || []).filter((r: any) => String(r.status).toLowerCase() === 'missing');
  return rows.map((r: any) => `${String(r.method).toUpperCase()} ${r.path}`).sort();
}

function totals(cov: any) {
  return (
    cov?.totals || {
      ops: 0,
      covered: 0,
      partial: 0,
      missing: 0,
      deferred: 0,
    }
  );
}

function main() {
  const before = loadJson(BEFORE);
  const after = loadJson(AFTER);
  const summary = loadJson(SUMMARY) || {
    implemented: [],
    stillMissing: [],
    filesChanged: [],
    turns: 0,
  };
  const reexec = loadJson(REEXEC) || {};

  const beforeMissing = missingKeys(before);
  const afterMissing = missingKeys(after);
  const beforeSet = new Set(beforeMissing);
  const afterSet = new Set(afterMissing);
  const closed = beforeMissing.filter((k) => !afterSet.has(k));
  const still = afterMissing;
  const newlyMissing = afterMissing.filter((k) => !beforeSet.has(k));

  const tb = totals(before);
  const ta = totals(after);

  const lines = [
    `# Swagger gap agent report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Before | After |`,
    `|--------|--------|-------|`,
    `| Ops | ${tb.ops} | ${ta.ops} |`,
    `| Covered | ${tb.covered} | ${ta.covered} |`,
    `| Partial | ${tb.partial} | ${ta.partial} |`,
    `| Missing | ${tb.missing} | ${ta.missing} |`,
    `| Deferred | ${tb.deferred} | ${ta.deferred} |`,
    ``,
    `- Agent turns: ${summary.turns ?? 'n/a'}`,
    `- Files changed (agent): ${(summary.filesChanged || []).length}`,
    ``,
    `## Implemented (closed this run)`,
    ``,
    ...(closed.length ? closed.map((x) => `- \`${x}\``) : ['- _(none — no gaps closed)_']),
    ``,
    `## Still missing`,
    ``,
    ...(still.length ? still.map((x) => `- \`${x}\``) : ['- _(none)_']),
    ``,
    ...(newlyMissing.length
      ? [
          `## Newly missing (appeared after agent)`,
          ``,
          ...newlyMissing.map((x) => `- \`${x}\``),
          ``,
        ]
      : []),
    `## Files changed`,
    ``,
    ...((summary.filesChanged || []).length
      ? summary.filesChanged.map((x: string) => `- \`${x}\``)
      : ['- _(none recorded)_']),
    ``,
    `## Re-exec`,
    ``,
    `- Consumer: ${reexec.consumer || 'n/a'}`,
    `- Swagger coverage: ${reexec.swagger || 'n/a'}`,
    `- Commands:`,
    `  - \`npm run test:consumer\``,
    `  - \`npm run test:swagger-coverage\``,
    ``,
    `## Agent notes`,
    ``,
    summary.notes ? String(summary.notes) : '_(none)_',
    ``,
  ];

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`Closed ${closed.length}; still missing ${still.length}`);
}

main();
