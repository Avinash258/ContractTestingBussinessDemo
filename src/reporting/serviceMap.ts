import { CONTRACTS, SERVICES, type ServiceId } from '../catalog/contracts';
import type { PhaseStatus, PhaseSummary, ServiceMapNode } from './types';

const STATUS: Record<string, PhaseStatus> = {
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  unknown: 'unknown',
};

function statusFromCounts(passed: number, failed: number, total: number): PhaseStatus {
  if (total === 0) return 'unknown';
  if (failed > 0) return 'failed';
  if (passed > 0) return 'passed';
  return 'unknown';
}

/** TaxMesh topology — Client → Gateway → CLM…DOC (EY_Demo-style map). */
export function buildTaxMeshServiceMap(consumer: PhaseSummary, provider: PhaseSummary) {
  const serviceIds = Object.keys(SERVICES) as ServiceId[];

  const stats: Record<string, { passed: number; failed: number; total: number; endpoints: ServiceMapNode['endpoints'] }> =
    {};

  for (const id of serviceIds) {
    stats[id] = { passed: 0, failed: 0, total: 0, endpoints: [] };
  }
  stats.Gateway = { passed: 0, failed: 0, total: 0, endpoints: [] };
  stats.Client = { passed: 0, failed: 0, total: 0, endpoints: [] };

  for (const ix of provider.interactions || []) {
    let key = ix.provider.replace(/^TaxMesh-/, '');
    if (key === 'Gateway' || /gateway/i.test(ix.provider)) key = 'Gateway';
    if (!stats[key]) stats[key] = { passed: 0, failed: 0, total: 0, endpoints: [] };
    stats[key].total += 1;
    if (ix.status === 'passed') stats[key].passed += 1;
    if (ix.status === 'failed') stats[key].failed += 1;
    stats[key].endpoints!.push({
      phase: 'provider',
      endpoint: ix.endpoint || ix.description,
      status: ix.status,
      reason: ix.reason,
    });
  }

  if (consumer.ran) {
    stats.Client = {
      passed: consumer.passed,
      failed: consumer.failed,
      total: consumer.total,
      endpoints: (consumer.tests || consumer.interactions || []).map((t: any) => ({
        phase: 'consumer',
        endpoint: t.endpoint || t.name || t.description || '',
        status: t.status,
        reason: t.reason,
      })),
    };
  }

  // Roll gateway health from gateway interactions or overall provider if none tagged
  if (stats.Gateway.total === 0 && provider.ran) {
    const anyFailed = provider.failed > 0;
    stats.Gateway = {
      passed: anyFailed ? 0 : 1,
      failed: anyFailed ? 1 : 0,
      total: 1,
      endpoints: [],
    };
  }

  const nodes: ServiceMapNode[] = [
    {
      id: 'Client',
      label: 'TaxMesh Client / Pact consumer',
      shortLabel: 'Client',
      layer: 'presentation',
      status: statusFromCounts(stats.Client.passed, stats.Client.failed, stats.Client.total),
      ...stats.Client,
    },
    {
      id: 'Gateway',
      label: 'API Gateway :4100',
      shortLabel: 'Gateway',
      layer: 'gateway',
      status: statusFromCounts(stats.Gateway.passed, stats.Gateway.failed, stats.Gateway.total),
      ...stats.Gateway,
    },
    ...serviceIds.map((id) => ({
      id,
      label: `${SERVICES[id].name || id} :${SERVICES[id].port}`,
      shortLabel: id,
      layer: 'service',
      status: statusFromCounts(stats[id].passed, stats[id].failed, stats[id].total),
      ...stats[id],
    })),
  ];

  const edgeDefs = [
    { from: 'Client', to: 'Gateway' },
    { from: 'Gateway', to: 'CLM' },
    { from: 'Gateway', to: 'MDM' },
    { from: 'Gateway', to: 'ACC' },
    { from: 'Gateway', to: 'TAX' },
    { from: 'Gateway', to: 'ALC' },
    { from: 'Gateway', to: 'DOC' },
    ...CONTRACTS.map((c) => ({ from: c.producer, to: c.consumer, id: c.id })),
  ];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = edgeDefs.map((e) => {
    const from = byId[e.from];
    const to = byId[e.to];
    let status: PhaseStatus = STATUS.unknown;
    if (from?.status === 'failed' || to?.status === 'failed') status = 'failed';
    else if (from?.status === 'passed' && to?.status === 'passed') status = 'passed';
    else if (from?.total || to?.total) status = 'passed';
    return { ...e, status };
  });

  const serviceNodes = nodes.filter((n) => n.layer === 'service' || n.layer === 'gateway');
  const summary = {
    healthy: serviceNodes.filter((n) => n.status === 'passed').length,
    failed: serviceNodes.filter((n) => n.status === 'failed').length,
    unknown: serviceNodes.filter((n) => n.status === 'unknown' || n.status === 'skipped').length,
  };

  return { nodes, edges, summary };
}

/** SVG positions for TaxMesh map (EY_Demo layout style). */
export const MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  Client: { x: 90, y: 230 },
  Gateway: { x: 250, y: 230 },
  CLM: { x: 430, y: 80 },
  MDM: { x: 560, y: 120 },
  ACC: { x: 680, y: 180 },
  TAX: { x: 680, y: 280 },
  ALC: { x: 560, y: 340 },
  DOC: { x: 430, y: 380 },
};

export const STATUS_COLOR: Record<string, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  skipped: '#f59e0b',
  unknown: '#64748b',
};

export function buildServiceMapSvg(serviceMap: ReturnType<typeof buildTaxMeshServiceMap>, opts?: { light?: boolean }) {
  const bg = opts?.light ? '#f8fafc' : '#0f172a';
  const text = opts?.light ? '#1f2937' : '#e8eef7';
  const muted = opts?.light ? '#6b7280' : '#8fa3bf';

  const edgeLines = (serviceMap.edges || [])
    .map((edge) => {
      const from = MAP_POSITIONS[edge.from];
      const to = MAP_POSITIONS[edge.to];
      if (!from || !to) return '';
      const color = STATUS_COLOR[edge.status || 'unknown'] || STATUS_COLOR.unknown;
      const dash = edge.status === 'failed' ? '6,4' : '8,6';
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}" opacity="0.85"/>`;
    })
    .join('');

  const nodeGroups = (serviceMap.nodes || [])
    .map((node) => {
      const pos = MAP_POSITIONS[node.id];
      if (!pos) return '';
      const color = STATUS_COLOR[node.status] || STATUS_COLOR.unknown;
      const count = node.total > 0 ? `${node.passed}` : '—';
      return `
        <g class="map-node map-${node.status}" data-service-id="${node.id}" transform="translate(${pos.x}, ${pos.y})">
          <title>${node.label} — ${node.status.toUpperCase()} (${node.passed}/${node.total})</title>
          <circle r="34" fill="${opts?.light ? '#ffffff' : '#1a2438'}" stroke="${color}" stroke-width="4"/>
          <circle r="42" fill="none" stroke="${color}" stroke-width="2" opacity="0.35"/>
          <text text-anchor="middle" y="6" font-size="11" font-weight="600" fill="${text}" font-family="Segoe UI,sans-serif">${node.shortLabel || node.id}</text>
          <text text-anchor="middle" y="54" font-size="11" fill="${color}" font-weight="700" font-family="Segoe UI,sans-serif">${count}</text>
        </g>`;
    })
    .join('');

  const s = serviceMap.summary || { healthy: 0, failed: 0, unknown: 0 };

  return `
    <svg viewBox="0 0 780 460" role="img" aria-label="TaxMesh microservice health map" style="background:${bg};width:100%;min-width:640px;height:auto;display:block">
      <g transform="translate(24, 24)">
        <text fill="${muted}" font-size="12" font-family="Segoe UI,sans-serif">Healthy ${s.healthy} · Failed ${s.failed} · Untested ${s.unknown}</text>
      </g>
      ${edgeLines}
      ${nodeGroups}
    </svg>`;
}
