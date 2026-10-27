import fs from 'fs';
import path from 'path';

export type GatewayFileConfig = {
  gatewayBaseUrl: string;
  localFallback?: string;
};

const CONFIG_NAME = 'gateway.config.json';

function findConfigPath(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, CONFIG_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), CONFIG_NAME);
}

/** Strip trailing slash and accidental /api-docs or /openapi paths. */
export function normalizeGatewayOrigin(raw: string): string {
  let g = String(raw || '').trim();
  if (!g) return '';
  g = g.replace(/\/$/, '');
  const docs = g.indexOf('/api-docs');
  if (docs >= 0) g = g.slice(0, docs);
  const openapi = g.indexOf('/openapi');
  if (openapi >= 0) g = g.slice(0, openapi);
  return g.replace(/\/$/, '');
}

export function readGatewayFileConfig(
  configPath = findConfigPath()
): GatewayFileConfig {
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as GatewayFileConfig;
  if (!parsed?.gatewayBaseUrl || typeof parsed.gatewayBaseUrl !== 'string') {
    throw new Error(
      `${CONFIG_NAME} must include string "gatewayBaseUrl" (edit that file, then npm run sync:gateway)`
    );
  }
  return parsed;
}

/**
 * Resolve TaxMesh gateway origin.
 * Priority: env override → gateway.config.json → localFallback → :4100
 */
export function resolveGatewayBaseUrl(options?: {
  preferLocal?: boolean;
  configPath?: string;
}): string {
  const fromEnv = normalizeGatewayOrigin(
    process.env.GATEWAY_BASE_URL ||
      process.env.TAXMESH_BASE_URL ||
      process.env.PACT_PROVIDER_URL ||
      ''
  );
  if (fromEnv) return fromEnv;

  const file = readGatewayFileConfig(options?.configPath);
  if (options?.preferLocal) {
    return normalizeGatewayOrigin(
      file.localFallback || 'http://127.0.0.1:4100'
    );
  }

  const fromFile = normalizeGatewayOrigin(file.gatewayBaseUrl);
  if (fromFile) return fromFile;

  return normalizeGatewayOrigin(
    file.localFallback || 'http://127.0.0.1:4100'
  );
}
