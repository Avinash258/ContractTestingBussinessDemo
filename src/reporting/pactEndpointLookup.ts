import fs from 'fs';
import path from 'path';
import type { InteractionResult, PhaseSummary } from './types';

export interface PactInteractionMeta {
  method: string;
  path: string;
  endpoint: string;
  consumer?: string;
  provider?: string;
  pactFile?: string;
}

/** Build description → HTTP endpoint lookup from generated pact JSON files. */
export function buildPactEndpointLookup(pactsDir: string): Map<string, PactInteractionMeta> {
  const map = new Map<string, PactInteractionMeta>();
  if (!pactsDir || !fs.existsSync(pactsDir)) return map;

  for (const file of fs.readdirSync(pactsDir).filter((f) => f.endsWith('.json'))) {
    try {
      const full = path.join(pactsDir, file);
      const pact = JSON.parse(fs.readFileSync(full, 'utf8'));
      const consumer = pact?.consumer?.name;
      const provider = pact?.provider?.name;
      for (const interaction of pact?.interactions || []) {
        const description = String(interaction?.description || '').trim();
        if (!description) continue;
        const method = String(interaction?.request?.method || 'GET').toUpperCase();
        const reqPath = String(interaction?.request?.path || '');
        if (!reqPath) continue;
        const meta: PactInteractionMeta = {
          method,
          path: reqPath,
          endpoint: `${method} ${reqPath}`,
          consumer,
          provider,
          pactFile: file,
        };
        if (!map.has(description)) map.set(description, meta);
        // Also index by lowercase for soft matches
        const lower = description.toLowerCase();
        if (!map.has(lower)) map.set(lower, meta);
      }
    } catch {
      // ignore unreadable pact files
    }
  }
  return map;
}

function parseEndpointFromText(text: string): string {
  const m = String(text || '').match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : '';
}

/** Heuristic fallbacks when pact files are not on disk (email-only refresh). */
function heuristicEndpointFromDescription(description: string): string {
  const d = String(description || '').toLowerCase();
  if (!d) return '';

  const ct = /\b(ct-\d{2})\b/i.exec(description);
  if (ct && /contract detail/i.test(description)) {
    return `GET /api/contracts/${ct[1].toUpperCase()}`;
  }

  const heuristics: Array<[RegExp, string]> = [
    [/health check|health against/, 'GET /api/health'],
    [/request for architecture|architecture/, 'GET /api/architecture'],
    [/request for contracts\b|list contracts/, 'GET /api/contracts'],
    [/flow edges|request for flow edges/, 'GET /api/flow/edges'],
    [/request for flow\b|get flow\b/, 'GET /api/flow'],
    [/filing\/datasets|filing datasets/, 'GET /api/filing/datasets'],
    [/filing\/gates|filing gates/, 'GET /api/filing/gates'],
    [/filing\/jobs|filing jobs/, 'GET /api/filing/jobs'],
    [/filing\/status|filing status/, 'GET /api/filing/status'],
    [/filing reset|post filing reset/, 'POST /api/filing/reset'],
    [/filing run-all|post filing run-all/, 'POST /api/filing/run-all'],
    [/filing run\/cem|post filing run\/cem/, 'POST /api/filing/run/cem'],
    [/filing run\/tax|post filing run\/tax/, 'POST /api/filing/run/tax'],
    [/filing alc allocate|alc allocate/, 'POST /api/filing/alc/allocate'],
    [/filing tax calculate|tax calculate/, 'POST /api/filing/tax/calculate'],
    [/upload\/acc/, 'POST /api/filing/upload/acc'],
    [/upload\/clm/, 'POST /api/filing/upload/clm'],
    [/upload\/mdm/, 'POST /api/filing/upload/mdm'],
    [/openapi|swagger/, 'GET /openapi.json'],
  ];

  for (const [re, endpoint] of heuristics) {
    if (re.test(d)) return endpoint;
  }

  const flowPair =
    /getflowdownstreampair\s+([a-z]+)\/([a-z]+)/i.exec(description) ||
    /flow\/downstream\/([A-Z]+)->([A-Z]+)/i.exec(description);
  if (flowPair) {
    return `GET /api/flow/downstream/${flowPair[1].toUpperCase()}->${flowPair[2].toUpperCase()}`;
  }
  const upPair =
    /getflowupstreampair\s+([a-z]+)\/([a-z]+)/i.exec(description) ||
    /flow\/upstream\/([A-Z]+)->([A-Z]+)/i.exec(description);
  if (upPair) {
    return `GET /api/flow/upstream/${upPair[1].toUpperCase()}->${upPair[2].toUpperCase()}`;
  }

  const service = /\b(CLM|MDM|ACC|TAX|ALC|DOC)\b/i.exec(description);
  if (service && /discovery|consume|upstream|downstream|contracts/i.test(d)) {
    const id = service[1].toUpperCase();
    if (/health/i.test(d)) return `GET /api/proxy/${id}/health`;
    if (/downstream/i.test(d)) return `GET /api/proxy/${id}/contracts/downstream`;
    if (/upstream/i.test(d)) return `GET /api/proxy/${id}/contracts/upstream`;
    if (/contracts/i.test(d)) return `GET /api/proxy/${id}/contracts`;
    return `GET /api/proxy/${id}`;
  }

  return '';
}

/** Fill missing provider/consumer endpoint fields from pact files + text heuristics. */
export function enrichPhaseEndpoints(
  phase: PhaseSummary,
  pactsDir: string,
  options?: { relativeSuites?: boolean }
): PhaseSummary {
  const lookup = buildPactEndpointLookup(pactsDir);

  const enrichIx = (ix: InteractionResult): InteractionResult => {
    const fromText = parseEndpointFromText(ix.description) || parseEndpointFromText(ix.endpoint || '');
    const meta =
      lookup.get(ix.description) ||
      lookup.get(String(ix.description || '').toLowerCase());
    const heuristic = heuristicEndpointFromDescription(ix.description);
    const endpoint = ix.endpoint || meta?.endpoint || fromText || heuristic || '';
    return {
      ...ix,
      endpoint,
      consumer: ix.consumer || meta?.consumer,
      pactFile: ix.pactFile || meta?.pactFile,
      method: ix.method || meta?.method || (endpoint ? endpoint.split(/\s+/)[0] : undefined),
      path: ix.path || meta?.path || (endpoint ? endpoint.replace(/^[A-Z]+\s+/, '') : undefined),
    };
  };

  const interactions = (phase.interactions || []).map(enrichIx);
  const tests = (phase.tests || []).map((test) => {
    const suite =
      options?.relativeSuites !== false && test.suite
        ? path.basename(test.suite)
        : test.suite;
    const endpoint =
      test.endpoint ||
      parseEndpointFromText(test.name) ||
      lookup.get(test.name)?.endpoint ||
      '';
    return { ...test, suite, endpoint };
  });
  const failures = (phase.failures || []).map((failure) => {
    const key = failure.interaction || failure.test || '';
    const meta = lookup.get(key) || lookup.get(key.toLowerCase());
    return {
      ...failure,
      endpoint: failure.endpoint || meta?.endpoint || parseEndpointFromText(key) || '',
    };
  });

  return { ...phase, interactions, tests, failures };
}
