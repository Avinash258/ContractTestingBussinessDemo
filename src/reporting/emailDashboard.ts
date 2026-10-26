/**
 * Email-safe HTML dashboard for TaxMesh contract reports.
 * No JavaScript — works in Outlook / Gmail body.
 */
import type { PactReport, ServiceMapNode } from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusColor(status: string): string {
  if (status === 'passed') return '#15803d';
  if (status === 'failed') return '#b91c1c';
  if (status === 'skipped') return '#b45309';
  return '#6b7280';
}

function statusBadge(status: string): string {
  const color = statusColor(status);
  const label = escapeHtml(String(status || 'unknown').toUpperCase());
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${color};background:${color}1a">${label}</span>`;
}

function buildArtifactLinks(options: {
  buildId?: string;
  buildUrl?: string;
  collectionUri?: string;
  teamProject?: string;
}): string {
  const links: string[] = [];
  const { buildId, buildUrl, collectionUri, teamProject } = options;

  if (buildUrl && buildUrl.startsWith('http')) {
    links.push(`<a href="${escapeHtml(buildUrl)}">Pipeline run${buildId ? ` #${escapeHtml(buildId)}` : ''}</a>`);
  } else if (buildId && collectionUri && teamProject) {
    const base = String(collectionUri).replace(/\/$/, '');
    const project = encodeURIComponent(teamProject);
    links.push(
      `<a href="${escapeHtml(`${base}/${project}/_build/results?buildId=${buildId}`)}">Pipeline run #${escapeHtml(buildId)}</a>`
    );
  }

  if (buildId && collectionUri && teamProject) {
    const base = String(collectionUri).replace(/\/$/, '');
    const project = encodeURIComponent(teamProject);
    links.push(
      `<a href="${escapeHtml(`${base}/${project}/_build/results?buildId=${buildId}&view=artifacts&artifactName=pact-dashboard`)}">Download dashboard artifact</a>`
    );
    links.push(
      `<a href="${escapeHtml(`${base}/${project}/_build/results?buildId=${buildId}&view=artifacts&artifactName=pact-provider-report`)}">Download HTML report artifact</a>`
    );
  }

  return links.join(' &nbsp;|&nbsp; ');
}

function buildTopologyTable(serviceMap: PactReport['serviceMap']): string {
  const nodes = serviceMap?.nodes || [];
  if (!nodes.length) return '';

  // TaxMesh chain
  const chain = ['Client', 'Gateway'];
  const chainCells = chain
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean)
    .map((node) => {
      const n = node as ServiceMapNode;
      const color = statusColor(n.status);
      return `<td style="padding:10px;border:1px solid #dbe3ef;text-align:center;background:#fff">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};margin:0 auto 6px"></div>
        <div style="font-size:12px;font-weight:600;color:#1f2937">${escapeHtml(n.shortLabel || n.label)}</div>
        <div style="font-size:11px;color:${color};font-weight:700">${escapeHtml(String(n.status).toUpperCase())}</div>
        <div style="font-size:11px;color:#6b7280">${n.passed}/${n.total}</div>
      </td>`;
    })
    .join('<td style="padding:0 4px;color:#9ca3af;font-size:18px">→</td>');

  const serviceRows = nodes
    .filter((node) => node.layer === 'service')
    .map((node) => {
      const color = statusColor(node.status);
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #dbe3ef"><strong>${escapeHtml(node.label)}</strong></td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef;color:${color};font-weight:700">${escapeHtml(String(node.status).toUpperCase())}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef">Gateway → ${escapeHtml(node.shortLabel || node.label)}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef">${node.passed}/${node.total}</td>
        <td style="padding:8px 10px;border:1px solid #dbe3ef">${node.failed}</td>
      </tr>`;
    })
    .join('');

  const summary = serviceMap.summary || { healthy: 0, failed: 0, unknown: 0 };

  return `
    <div style="margin:20px 0;padding:16px;border:1px solid #dbe3ef;border-radius:10px;background:#ffffff">
      <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1f2937">Microservice map</p>
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280">Healthy ${summary.healthy || 0} · Failed ${summary.failed || 0} · Untested ${summary.unknown || 0}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:14px">
        <tr>${chainCells}</tr>
      </table>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left">Service</th>
            <th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left">Status</th>
            <th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left">Route</th>
            <th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left">Passed/Total</th>
            <th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left">Failed</th>
          </tr>
        </thead>
        <tbody>${serviceRows}</tbody>
      </table>
    </div>`;
}

function buildEndpointTable(
  title: string,
  rows: Record<string, unknown>[],
  columns: Array<{ label: string; render: (row: Record<string, unknown>) => string }>
): string {
  if (!rows.length) return '';

  const head = columns
    .map(
      (col) =>
        `<th style="padding:8px 10px;border:1px solid #dbe3ef;text-align:left;background:#f8fafc;font-size:12px">${escapeHtml(col.label)}</th>`
    )
    .join('');

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td style="padding:8px 10px;border:1px solid #dbe3ef;vertical-align:top;font-size:12px">${col.render(row)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <div style="margin:20px 0;padding:16px;border:1px solid #dbe3ef;border-radius:10px;background:#ffffff">
      <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1f2937">${escapeHtml(title)}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>`;
}

export function buildEmailDashboardBody(
  report: PactReport,
  options: {
    buildId?: string;
    buildUrl?: string;
    collectionUri?: string;
    teamProject?: string;
    compact?: boolean;
  } = {}
): string {
  const compact = options.compact !== false;
  const consumer = report.consumer || ({} as PactReport['consumer']);
  const provider = report.provider || ({} as PactReport['provider']);
  const env = report.environment || {};
  const overall = report.overallStatus || 'unknown';
  const overallColor = statusColor(
    overall === 'passed' ? 'passed' : overall === 'failed' ? 'failed' : 'skipped'
  );

  const overallPassed = (consumer.passed || 0) + (provider.passed || 0);
  const overallFailed = (consumer.failed || 0) + (provider.failed || 0);
  const overallTotal = (consumer.total || 0) + (provider.total || 0);

  const targetUrl =
    provider.providerBaseUrl ||
    env.GATEWAY_BASE_URL ||
    env.TAXMESH_BASE_URL ||
    env.PACT_PROVIDER_URL ||
    'n/a';

  const artifactLinks = buildArtifactLinks({
    buildId: options.buildId || env.BUILD_BUILDID,
    buildUrl: options.buildUrl,
    collectionUri: options.collectionUri || env.SYSTEM_COLLECTIONURI,
    teamProject: options.teamProject || env.SYSTEM_TEAMPROJECT,
  });

  const metricCell = (label: string, value: string, sub = '') =>
    `<td style="width:25%;padding:12px;border:1px solid #dbe3ef;background:#f8fafc;vertical-align:top">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">${escapeHtml(label)}</div>
      <div style="font-size:22px;font-weight:700;color:#1f2937;margin-top:4px">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">${sub}</div>` : ''}
    </td>`;

  const topology = buildTopologyTable(report.serviceMap);

  const failedProviderRows = (provider.interactions || [])
    .filter((item) => item.status === 'failed')
    .map((item) => ({
      endpoint: item.endpoint || '—',
      description: item.description || '—',
      expected: item.expected || '—',
      actual: item.actual || item.reason || '—',
    }));

  const failedConsumerRows = (consumer.tests || consumer.interactions || [])
    .filter((test: any) => test.status === 'failed')
    .map((test: any) => ({
      endpoint: test.endpoint || '—',
      name: test.name || test.description || '—',
      reason: test.reason || '-',
    }));

  const failureSection = compact
    ? [
        failedProviderRows.length
          ? buildEndpointTable('Provider failures', failedProviderRows, [
              { label: 'Endpoint', render: (r) => escapeHtml(r.endpoint) },
              { label: 'Expected', render: (r) => escapeHtml(r.expected) },
              { label: 'Actual', render: (r) => escapeHtml(r.actual) },
            ])
          : '',
        failedConsumerRows.length
          ? buildEndpointTable('Consumer failures', failedConsumerRows, [
              { label: 'Endpoint', render: (r) => escapeHtml(r.endpoint) },
              { label: 'Test', render: (r) => escapeHtml(r.name) },
              { label: 'Reason', render: (r) => escapeHtml(r.reason) },
            ])
          : '',
      ].join('')
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#ffffff;font-family:Segoe UI,sans-serif;color:#1f2937">
  <div style="max-width:720px;margin:0 auto">
    <div style="padding:20px;border:1px solid #dbe3ef;border-radius:12px;background:#ffffff;margin-bottom:16px">
      <p style="margin:0;font-size:20px;font-weight:700">TaxMesh Contract Test Report</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280">
        Target ${escapeHtml(targetUrl)}
        · Generated ${escapeHtml(report.generatedAt || '')}
      </p>
      <p style="margin:12px 0 0;font-size:24px;font-weight:800;color:${overallColor}">${escapeHtml(overall.toUpperCase())}</p>
      ${artifactLinks ? `<p style="margin:12px 0 0;font-size:13px">${artifactLinks}</p>` : ''}
    </div>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr>
        ${metricCell('Consumer', `${consumer.passed || 0}/${consumer.total || 0}`, statusBadge(consumer.status))}
        ${metricCell('Provider', `${provider.passed || 0}/${provider.total || 0}`, statusBadge(provider.status))}
        ${metricCell('Overall', `${overallPassed}/${overallTotal}`, `<span style="color:${overallColor};font-weight:700">${escapeHtml(overall.toUpperCase())}</span>`)}
        ${metricCell('Failed', String(overallFailed), `${report.serviceMap?.summary?.failed || 0} service(s)`)}
      </tr>
    </table>

    ${topology}
    ${failureSection}

    <div style="margin:16px 0;padding:14px 16px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff">
      <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8">Interactive dashboard (zip attachment)</p>
      <p style="margin:8px 0 0;font-size:13px;color:#1e40af">
        Unzip <strong>TaxMesh-Contract-Dashboard.zip</strong>, then open <strong>index.html</strong> in your browser.
      </p>
    </div>

  </div>
</body></html>`;
}
