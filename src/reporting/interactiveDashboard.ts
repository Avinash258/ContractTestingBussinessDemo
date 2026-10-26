import type { PactReport } from './types';
import { MAP_POSITIONS, STATUS_COLOR, buildServiceMapSvg } from './serviceMap';

function encodeReportForHtmlEmbed(report: PactReport): string {
  return Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
}

function buildInlineReportBootstrapHtml(report: PactReport): string {
  const encoded = encodeReportForHtmlEmbed(report);
  return `<script id="pact-report-data" type="text/plain" data-encoding="base64">${encoded}</script>
<script>window.__PACT_REPORT__=JSON.parse(atob(document.getElementById('pact-report-data').textContent.trim()));</script>`;
}

/** Single-file interactive map — ContractTestDemo / EY_Demo style. */
export function buildStandaloneInteractiveDashboard(report: PactReport): string {
  const staticSvg = buildServiceMapSvg(report.serviceMap as any, { light: true });
  const bootstrap = buildInlineReportBootstrapHtml(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TaxMesh Interactive Service Map</title>
  <style>
    body { margin:0; font-family:Segoe UI,sans-serif; background:#f4f7fb; color:#1f2937; }
    .wrap { max-width:960px; margin:0 auto; padding:20px; }
    .card { background:#fff; border:1px solid #dbe3ef; border-radius:12px; padding:20px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:1.4rem; }
    .meta { color:#6b7280; font-size:0.9rem; margin-bottom:12px; }
    .map-wrap { border:1px solid #dbe3ef; border-radius:12px; overflow:hidden; background:#f8fafc; }
    .map-node { cursor:pointer; }
    .map-node:hover circle:nth-child(2) { stroke-width:6; }
    .map-node.selected circle:nth-child(2) { stroke-width:6; }
    .detail { margin-top:16px; padding:14px; background:#f8fafc; border:1px solid #dbe3ef; border-radius:10px; display:none; }
    .detail.show { display:block; }
    .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.7rem; font-weight:700; text-transform:uppercase; }
    .endpoint { padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; margin-top:6px; font-size:0.85rem; background:#fff; }
    code { background:#eef2ff; padding:2px 6px; border-radius:4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>TaxMesh Interactive Microservice Map</h1>
      <p class="meta">Click any node for endpoints. Generated ${report.generatedAt || ''}</p>
      <p><strong>Overall:</strong> <span id="overallStatus"></span></p>
      <div class="map-wrap" id="mapHost">${staticSvg}</div>
      <div class="detail" id="detailPanel"></div>
    </div>
  </div>
  ${bootstrap}
  <script>
    const STATUS_COLOR = ${JSON.stringify(STATUS_COLOR)};
    const MAP_POSITIONS = ${JSON.stringify(MAP_POSITIONS)};
    function badge(status) {
      const color = STATUS_COLOR[status] || STATUS_COLOR.unknown;
      return '<span class="badge" style="color:' + color + ';background:' + color + '1a">' + String(status || 'unknown').toUpperCase() + '</span>';
    }
    function renderDetail(node) {
      const panel = document.getElementById('detailPanel');
      if (!node) { panel.classList.remove('show'); return; }
      const endpoints = (node.endpoints || []).map(function(ep) {
        return '<div class="endpoint"><code>' + (ep.endpoint || '—') + '</code> (' + ep.phase + ') ' + badge(ep.status) + '</div>';
      }).join('') || '<p class="meta">No contract-tested endpoints for this node.</p>';
      panel.innerHTML = '<h3>' + (node.label || node.id) + ' ' + badge(node.status) + '</h3>' +
        '<p class="meta">' + (node.passed || 0) + '/' + (node.total || 0) + ' passed · ' + (node.failed || 0) + ' failed</p>' + endpoints;
      panel.classList.add('show');
    }
    function wireMap() {
      const report = window.__PACT_REPORT__ || {};
      document.getElementById('overallStatus').innerHTML = badge(report.overallStatus || 'unknown');
      const nodes = (report.serviceMap && report.serviceMap.nodes) || [];
      const byId = Object.fromEntries(nodes.map(function(n) { return [n.id, n]; }));
      document.querySelectorAll('#mapHost [data-service-id]').forEach(function(group) {
        const node = byId[group.dataset.serviceId];
        if (!node) return;
        group.classList.add('map-node');
        group.addEventListener('click', function() {
          document.querySelectorAll('.map-node').forEach(function(g) { g.classList.remove('selected'); });
          group.classList.add('selected');
          renderDetail(node);
        });
      });
    }
    wireMap();
  </script>
</body>
</html>`;
}
