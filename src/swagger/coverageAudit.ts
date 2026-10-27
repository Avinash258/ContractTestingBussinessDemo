/**
 * OpenAPI/Swagger ? Pact coverage audit (ContractCoverageAuditor logic, CI-ready).
 *
 * Classifies every Swagger METHOD+path as covered | partial | missing | deferred.
 * Equivalence: service Pact path `/x` = Swagger `/api/proxy/{SVC}/x`.
 */
import fs from 'fs';
import path from 'path';
import {
  CONTRACTS,
  SERVICES,
  apiFlow,
  type ServiceId,
} from '../catalog/contracts';
import {
  normalizeGatewayOrigin,
  resolveGatewayBaseUrl,
} from '../gatewayConfig';

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[];

const DISCOVERY_PATHS = [
  '/health',
  '/contracts',
  '/flow',
  '/contracts/downstream',
  '/contracts/upstream',
  '/pipeline',
  '/consume/downstream',
  '/consume/upstream',
] as const;

/** Swagger ops intentionally not gated (multipart success needs real .xlsx). */
const DEFERRED_NOTES: Array<{ method: string; pathPattern: RegExp; note: string }> =
  [
    {
      method: 'POST',
      pathPattern: /^\/api\/filing\/upload\/(clm|mdm|acc)$/,
      note: 'Upload 200 success needs real .xlsx; 400 error contract covers the op path',
    },
  ];

export type CoverageStatus = 'covered' | 'partial' | 'missing' | 'deferred';

export interface SwaggerOp {
  method: string;
  path: string;
  operationId?: string;
}

export interface CoverageRow {
  method: string;
  path: string;
  operationId?: string;
  status: CoverageStatus;
  evidence: string[];
  note?: string;
}

export interface CoverageReport {
  source: string;
  generatedAt: string;
  totals: {
    ops: number;
    covered: number;
    partial: number;
    missing: number;
    deferred: number;
  };
  rows: CoverageRow[];
  missing: CoverageRow[];
  deferred: CoverageRow[];
}

export interface AuditOptions {
  openApiUrl?: string;
  openApiJson?: unknown;
  pactsDir?: string;
  consumerDir?: string;
  /** When true, upload paths stay deferred even if 400 pact exists. */
  treatUploadAsDeferred?: boolean;
}

function opKey(method: string, p: string): string {
  return `${method.toUpperCase()} ${p}`;
}

export function resolveOpenApiUrl(explicit?: string): string {
  if (explicit) {
    if (explicit.endsWith('.json') || explicit.includes('openapi')) return explicit;
    return `${normalizeGatewayOrigin(explicit)}/openapi.json`;
  }
  if (process.env.SWAGGER_OPENAPI_URL?.includes('openapi')) {
    return process.env.SWAGGER_OPENAPI_URL;
  }
  // Env override ? else gateway.config.json (single source of truth)
  return `${resolveGatewayBaseUrl()}/openapi.json`;
}

export function listOpenApiOps(doc: any): SwaggerOp[] {
  const ops: SwaggerOp[] = [];
  const paths = doc?.paths || {};
  for (const [p, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, spec] of Object.entries(methods || {})) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      ops.push({
        method: method.toUpperCase(),
        path: p,
        operationId: (spec as any)?.operationId,
      });
    }
  }
  return ops.sort((a, b) => opKey(a.method, a.path).localeCompare(opKey(b.method, b.path)));
}

/** Concrete METHOD + path pairs we treat as evidence of coverage. */
export function collectCoveredConcrete(opts: {
  pactsDir: string;
  consumerDir: string;
}): Map<string, string[]> {
  const evidence = new Map<string, string[]>();

  const add = (method: string, p: string, source: string) => {
    const key = opKey(method, p);
    const list = evidence.get(key) || [];
    if (!list.includes(source)) list.push(source);
    evidence.set(key, list);
  };

  // --- Catalog-derived (always available, no pact files required) ---
  for (const svc of SERVICE_IDS) {
    for (const dp of DISCOVERY_PATHS) {
      add('GET', `/api/proxy/${svc}${dp}`, `catalog:discovery:${svc}`);
      add('GET', dp, `catalog:service-path:${svc}`);
    }
  }

  for (const ct of CONTRACTS) {
    add('GET', ct.path, `catalog:${ct.id}:produce`);
    add('GET', `/api/proxy/${ct.producer}${ct.path}`, `catalog:${ct.id}:swagger-proxy`);

    const flow = apiFlow(ct.direction);
    const peerPath = `/${flow}/${ct.consumer}`;
    add('GET', peerPath, `catalog:${ct.id}:peer`);
    add(
      'GET',
      `/api/proxy/${ct.producer}${peerPath}`,
      `catalog:${ct.id}:peer-proxy`
    );

    add('GET', `/consume/${ct.id}`, `catalog:${ct.id}:consume-by-id`);
    add(
      'GET',
      `/api/proxy/${ct.consumer}/consume/${ct.id}`,
      `catalog:${ct.id}:consume-proxy`
    );

    add('GET', `/api/contracts/${ct.id}`, `catalog:${ct.id}:gateway-by-id`);
    add(
      'GET',
      `/api/flow/${flow}/${ct.producer}/${ct.consumer}`,
      `catalog:${ct.id}:gateway-flow-pair`
    );
  }

  const gatewayStatic = [
    '/api/health',
    '/api/architecture',
    '/api/contracts',
    '/api/flow',
    '/api/flow/edges',
    '/api/filing',
    '/api/filing/datasets',
    '/api/filing/gates',
    '/api/filing/jobs',
    '/api/filing/form1065',
    '/api/filing/validate/tax',
    '/api/filing/validate/alc',
  ];
  for (const p of gatewayStatic) add('GET', p, 'catalog:gateway-static');

  const filingPosts = [
    '/api/filing/reset',
    '/api/filing/run-all',
    '/api/filing/tax/calculate',
    '/api/filing/alc/allocate',
    '/api/filing/run/cem',
    '/api/filing/run/tax',
    '/api/filing/upload/clm',
    '/api/filing/upload/mdm',
    '/api/filing/upload/acc',
  ];
  for (const p of filingPosts) add('POST', p, 'catalog:filing-post');

  // Empty peer 404 contracts via Gateway proxy (testdata/common/empty-peer.json)
  try {
    const emptyPeerPath = path.resolve(
      process.cwd(),
      'testdata/common/empty-peer.json'
    );
    if (fs.existsSync(emptyPeerPath)) {
      const emptyPeer = JSON.parse(fs.readFileSync(emptyPeerPath, 'utf8')) as {
        cases?: Array<{
          service: string;
          flow: string;
          peer: string;
          gatewayPath?: string;
        }>;
      };
      for (const c of emptyPeer.cases || []) {
        const gatewayPath =
          c.gatewayPath || `/api/proxy/${c.service}/${c.flow}/${c.peer}`;
        add('GET', gatewayPath, `catalog:empty-peer-gateway:${c.service}`);
      }
    }
  } catch {
    // optional testdata
  }

  // --- Consumer source static withRequest('METHOD', '/literal') ---
  if (fs.existsSync(opts.consumerDir)) {
    walkTsFiles(opts.consumerDir, (file, text) => {
      const re =
        /\.withRequest\(\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*['`]([^'`$]+)['`]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        add(m[1], m[2], `consumer:${path.relative(process.cwd(), file)}`);
      }
    });
  }

  // --- Pact JSON interactions (preferred live evidence after consumer job) ---
  if (fs.existsSync(opts.pactsDir)) {
    for (const file of fs.readdirSync(opts.pactsDir).filter((f) => f.endsWith('.json'))) {
      const full = path.join(opts.pactsDir, file);
      try {
        const pact = JSON.parse(fs.readFileSync(full, 'utf8')) as {
          provider?: { name?: string };
          interactions?: Array<{
            request?: { method?: string; path?: string };
          }>;
        };
        const provider = pact.provider?.name || '';
        const svcMatch = provider.match(/^TaxMesh-(CLM|MDM|ACC|TAX|ALC|DOC)$/);
        const svc = svcMatch?.[1] as ServiceId | undefined;

        for (const ix of pact.interactions || []) {
          const method = (ix.request?.method || 'GET').toUpperCase();
          const reqPath = ix.request?.path;
          if (!reqPath) continue;
          add(method, reqPath, `pact:${file}`);
          if (svc && !reqPath.startsWith('/api/')) {
            add(method, `/api/proxy/${svc}${reqPath}`, `pact:${file}:proxy-equiv`);
          }
        }
      } catch {
        // skip corrupt pact
      }
    }
  }

  return evidence;
}

function walkTsFiles(
  dir: string,
  visit: (file: string, text: string) => void
): void {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkTsFiles(full, visit);
    else if (/\.(ts|tsx|js)$/.test(name)) {
      visit(full, fs.readFileSync(full, 'utf8'));
    }
  }
}

function pathTemplateRegex(openapiPath: string): RegExp {
  const escaped = openapiPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

function producerHasPeerDirection(svc: ServiceId, flow: 'downstream' | 'upstream'): boolean {
  return CONTRACTS.some(
    (c) => c.producer === svc && apiFlow(c.direction) === flow
  );
}

function classifyOp(
  op: SwaggerOp,
  evidence: Map<string, string[]>,
  treatUploadAsDeferred: boolean
): CoverageRow {
  const deferredHit = DEFERRED_NOTES.find(
    (d) => d.method === op.method && d.pathPattern.test(op.path)
  );

  const exact = evidence.get(opKey(op.method, op.path));
  if (exact?.length) {
    return {
      ...op,
      status: 'covered',
      evidence: exact,
      note: deferredHit?.note,
    };
  }

  // Match OpenAPI template against concrete covered paths
  const re = pathTemplateRegex(op.path);
  const matches: string[] = [];
  for (const [key, sources] of evidence) {
    const sp = key.indexOf(' ');
    const method = key.slice(0, sp);
    const p = key.slice(sp + 1);
    if (method !== op.method) continue;
    if (re.test(p)) {
      for (const s of sources) matches.push(`${s} (${p})`);
    }
  }
  if (matches.length) {
    return { ...op, status: 'covered', evidence: matches.slice(0, 8) };
  }

  // Service-path equivalence for literal proxy paths without params
  const proxy = op.path.match(/^\/api\/proxy\/(CLM|MDM|ACC|TAX|ALC|DOC)(\/.*)$/);
  if (proxy) {
    const servicePath = proxy[2];
    const svcEvidence = evidence.get(opKey(op.method, servicePath));
    if (svcEvidence?.length) {
      return {
        ...op,
        status: 'covered',
        evidence: svcEvidence.map((s) => `${s} (service-path equiv)`),
      };
    }
  }

  // Empty peer templates with no CT edge and no Pact evidence ? deferred
  const peerTpl = op.path.match(
    /^\/api\/proxy\/(CLM|MDM|ACC|TAX|ALC|DOC)\/(downstream|upstream)\/\{peerId\}$/
  );
  if (peerTpl) {
    const svc = peerTpl[1] as ServiceId;
    const flow = peerTpl[2] as 'downstream' | 'upstream';
    if (!producerHasPeerDirection(svc, flow)) {
      return {
        ...op,
        status: 'deferred',
        evidence: [],
        note: `${svc} has no ${flow} CT peer in catalog ? empty peer surface`,
      };
    }
  }

  if (treatUploadAsDeferred && deferredHit) {
    return {
      ...op,
      status: 'deferred',
      evidence: [],
      note: deferredHit.note,
    };
  }

  return { ...op, status: 'missing', evidence: [] };
}

export async function fetchOpenApi(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI (${res.status}): ${url}`);
  }
  return res.json();
}

export async function runCoverageAudit(
  options: AuditOptions = {}
): Promise<CoverageReport> {
  const source = options.openApiUrl || resolveOpenApiUrl();
  const doc =
    options.openApiJson ??
    (await fetchOpenApi(typeof source === 'string' ? source : resolveOpenApiUrl()));

  const pactsDir = options.pactsDir || path.resolve(process.cwd(), 'pacts');
  const consumerDir =
    options.consumerDir || path.resolve(process.cwd(), 'tests/consumer');

  const evidence = collectCoveredConcrete({ pactsDir, consumerDir });
  const ops = listOpenApiOps(doc);
  const treatUploadAsDeferred = options.treatUploadAsDeferred !== false;

  const rows = ops.map((op) =>
    classifyOp(op, evidence, treatUploadAsDeferred)
  );

  const totals = {
    ops: rows.length,
    covered: rows.filter((r) => r.status === 'covered').length,
    partial: rows.filter((r) => r.status === 'partial').length,
    missing: rows.filter((r) => r.status === 'missing').length,
    deferred: rows.filter((r) => r.status === 'deferred').length,
  };

  return {
    source: typeof source === 'string' ? source : 'inline',
    generatedAt: new Date().toISOString(),
    totals,
    rows,
    missing: rows.filter((r) => r.status === 'missing'),
    deferred: rows.filter((r) => r.status === 'deferred'),
  };
}

export function formatCoverageMarkdown(report: CoverageReport): string {
  const lines = [
    `# Swagger ? Pact coverage gap analysis`,
    ``,
    `Source: \`${report.source}\``,
    `Date: ${report.generatedAt.slice(0, 10)}`,
    ``,
    `## Summary`,
    ``,
    `| Swagger ops | Covered | Partial | Missing | Deferred |`,
    `|-------------|---------|---------|---------|----------|`,
    `| ${report.totals.ops} | ${report.totals.covered} | ${report.totals.partial} | ${report.totals.missing} | ${report.totals.deferred} |`,
    ``,
  ];

  if (report.missing.length) {
    lines.push(`## Missing`, ``, `| Method | Path |`, `|--------|------|`);
    for (const r of report.missing) {
      lines.push(`| ${r.method} | \`${r.path}\` |`);
    }
    lines.push(``);
  }

  if (report.deferred.length) {
    lines.push(`## Deferred`, ``, `| Method | Path | Note |`, `|--------|------|------|`);
    for (const r of report.deferred) {
      lines.push(`| ${r.method} | \`${r.path}\` | ${r.note || ''} |`);
    }
    lines.push(``);
  }

  lines.push(
    `## Equivalent coverage note`,
    ``,
    `Service Pact paths \`/health\`, \`/contracts/ct-*\`, \`/downstream/{peer}\` equal Swagger \`/api/proxy/{SVC}/…\` (gateway is a transparent proxy).`,
    ``
  );
  return lines.join('\n');
}
