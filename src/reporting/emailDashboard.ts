/**
 * Email-safe HTML dashboard for TaxMesh contract reports.
 * No JavaScript — works in Outlook / Gmail body.
 */
import type { PactReport, ServiceMapNode } from './types';
import { normalizeReportMismatches, parsePactMismatch } from './mismatchFormat';

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

function clarifyFailureSide(item: {
  expected?: string;
  actual?: string;
  reason?: string;
}): { expected: string; actual: string; summary: string } {
  const candidates = [item.reason, item.actual]
    .filter((c) => c && (String(c).includes('"mismatches"') || String(c).includes('"expected"')))
    .sort((a, b) => String(b).length - String(a).length);
  const source = candidates[0] || null;
  const weak =
    !item.expected ||
    /^(—|-|see mismatch|contract match)$/i.test(String(item.expected).trim());
  if (source || weak) {
    const parsed = parsePactMismatch(source || item.actual || item.reason || '');
    return {
      expected: weak ? parsed.expected : String(item.expected),
      actual:
        !item.actual || String(item.actual).includes('"mismatches"')
          ? parsed.actual
          : String(item.actual),
      summary: parsed.summary || item.reason || '—',
    };
  }
  return {
    expected: item.expected || '—',
    actual: item.actual || item.reason || '—',
    summary: item.reason || '—',
  };
}

export function buildEmailDashboardBody(
  reportInput: PactReport,
  options: {
    buildId?: string;
    buildUrl?: string;
    collectionUri?: string;
    teamProject?: string;
    compact?: boolean;
  } = {}
): string {
  const report = normalizeReportMismatches(reportInput);
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

  const failedProviderRows = (provider.failures || [])
    .map((item) => {
      const clarified = clarifyFailureSide(item);
      return {
        endpoint: item.endpoint || '—',
        description: item.interaction || '—',
        summary: clarified.summary,
        expected: clarified.expected,
        actual: clarified.actual,
      };
    })
    .concat(
      // Fallback if failures[] empty but interactions mark failed
      !(provider.failures || []).length
        ? (provider.interactions || [])
            .filter((item) => item.status === 'failed')
            .map((item) => {
              const clarified = clarifyFailureSide(item);
              return {
                endpoint: item.endpoint || '—',
                description: item.description || '—',
                summary: clarified.summary,
                expected: clarified.expected,
                actual: clarified.actual,
              };
            })
        : []
    );

  const failedConsumerRows = (consumer.failures || [])
    .map((item) => ({
      endpoint: item.endpoint || '—',
      name: item.test || '—',
      reason: item.reason || '—',
    }))
    .concat(
      !(consumer.failures || []).length
        ? (consumer.tests || consumer.interactions || [])
            .filter((test: any) => test.status === 'failed')
            .map((test: any) => ({
              endpoint: test.endpoint || '—',
              name: test.name || test.description || '—',
              reason: test.reason || '—',
            }))
        : []
    );

  const cov = report.coverage || {};
  const consumerGaps = cov.gaps?.consumer || [];
  const providerGaps = cov.gaps?.provider || [];
  const hasGaps = consumerGaps.length > 0 || providerGaps.length > 0;
  const isFailReport =
    overall === 'failed' || hasGaps || overallFailed > 0;

  const expectedCell = (value: unknown) =>
    `<div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:4px">Expected (contract)</div>
     <div style="font-family:Consolas,monospace;font-size:11px;line-height:1.35;white-space:pre-wrap;word-break:break-word;padding:8px;border-radius:6px;border:1px solid #86efac;background:#f0fdf4;color:#14532d">${escapeHtml(value)}</div>`;

  const actualCell = (value: unknown) =>
    `<div style="font-size:10px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-bottom:4px">Actual (live API)</div>
     <div style="font-family:Consolas,monospace;font-size:11px;line-height:1.35;white-space:pre-wrap;word-break:break-word;padding:8px;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#7f1d1d">${escapeHtml(value)}</div>`;

  const failureSection = compact
    ? [
        failedProviderRows.length
          ? buildEndpointTable(
              `Provider failures (${failedProviderRows.length}) — expected vs actual`,
              failedProviderRows.slice(0, 12),
              [
                {
                  label: 'Endpoint / interaction',
                  render: (r) =>
                    `<div style="font-weight:600">${escapeHtml(r.endpoint)}</div>
                     <div style="color:#6b7280;margin-top:4px">${escapeHtml(r.description)}</div>
                     <div style="color:#92400e;margin-top:6px;font-size:11px">${escapeHtml(r.summary)}</div>`,
                },
                { label: 'Expected', render: (r) => expectedCell(r.expected) },
                { label: 'Actual', render: (r) => actualCell(r.actual) },
              ]
            )
          : '',
        failedConsumerRows.length
          ? buildEndpointTable(
              `Consumer failures (${failedConsumerRows.length})`,
              failedConsumerRows.slice(0, 12),
              [
                { label: 'Endpoint', render: (r) => escapeHtml(r.endpoint) },
                { label: 'Test', render: (r) => escapeHtml(r.name) },
                { label: 'Why it failed', render: (r) => actualCell(r.reason) },
              ]
            )
          : '',
      ].join('')
    : '';

  const gapBanner = isFailReport
    ? `<div style="margin:0 0 16px;padding:14px 16px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2">
        <p style="margin:0;font-size:16px;font-weight:800;color:#991b1b">FAIL REPORT</p>
        <p style="margin:6px 0 0;font-size:13px;color:#7f1d1d">
          Contract and/or Swagger coverage gaps detected.
          Consumer swagger gaps: <strong>${consumerGaps.length}</strong>
          · Provider verification gaps: <strong>${providerGaps.length}</strong>
          · Missing OpenAPI ops: <strong>${cov.totals?.missing ?? consumerGaps.length}</strong>
        </p>
      </div>`
    : '';

  const gapSection = [
    consumerGaps.length
      ? buildEndpointTable(
          'Swagger gaps — missing in consumer / Pact',
          consumerGaps.slice(0, 40).map((g) => ({
            endpoint: `${g.method} ${g.path}`.trim(),
            note: g.note || 'No consumer contract',
            operation: g.operation || '—',
          })),
          [
            { label: 'Operation', render: (r) => escapeHtml(r.endpoint) },
            { label: 'Why', render: (r) => escapeHtml(r.note) },
            { label: 'Op id', render: (r) => escapeHtml(r.operation) },
          ]
        )
      : '',
    providerGaps.length
      ? buildEndpointTable(
          'Gaps — missing / failed on provider',
          providerGaps.slice(0, 40).map((g) => ({
            endpoint: `${g.method} ${g.path}`.trim(),
            note: g.note || 'Provider verification failed',
            operation: g.operation || '—',
          })),
          [
            { label: 'Endpoint', render: (r) => escapeHtml(r.endpoint) },
            { label: 'Detail', render: (r) => escapeHtml(r.note) },
            { label: 'Interaction', render: (r) => escapeHtml(r.operation) },
          ]
        )
      : '',
  ].join('');

  const howToRead = isFailReport
    ? `<div style="margin:0 0 16px;padding:12px 14px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb">
        <p style="margin:0;font-size:13px;font-weight:700;color:#92400e">How to read Expected vs Actual</p>
        <p style="margin:6px 0 0;font-size:12px;color:#78350f;line-height:1.45">
          <strong style="color:#166534">Expected (contract)</strong> is what the Pact file required.
          <strong style="color:#991b1b">Actual (live API)</strong> is what the service returned during provider verify.
          Open the attached dashboard for full field-level mismatch tables.
        </p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#f8fafc;font-family:Segoe UI,sans-serif;color:#1f2937">
  <div style="max-width:780px;margin:0 auto">
    ${gapBanner}
    ${howToRead}
    <div style="padding:20px;border:1px solid ${isFailReport ? '#fecaca' : '#dbe3ef'};border-radius:12px;background:${isFailReport ? '#fff5f5' : '#ffffff'};margin-bottom:16px">
      <p style="margin:0;font-size:20px;font-weight:700">TaxMesh Contract Test Report${isFailReport ? ' — FAIL' : ''}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280">
        Target ${escapeHtml(targetUrl)}
        · Generated ${escapeHtml(report.generatedAt || '')}
        ${env.PACT_SERVICES || env.RUN_MODE ? ` · Scope ${escapeHtml(String(env.PACT_SERVICES || env.RUN_MODE))}` : ''}
      </p>
      <p style="margin:12px 0 0;font-size:24px;font-weight:800;color:${isFailReport ? '#991b1b' : overallColor}">${escapeHtml((isFailReport ? 'failed' : overall).toUpperCase())}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280">
        Failed interactions: <strong style="color:#991b1b">${overallFailed}</strong>
        · Passed: <strong style="color:#166534">${overallPassed}</strong>
        · Total: <strong>${overallTotal}</strong>
      </p>
      ${artifactLinks ? `<p style="margin:12px 0 0;font-size:13px">${artifactLinks}</p>` : ''}
    </div>

    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr>
        ${metricCell('Consumer', `${consumer.passed || 0}/${consumer.total || 0}`, statusBadge(consumer.status))}
        ${metricCell('Provider', `${provider.passed || 0}/${provider.total || 0}`, statusBadge(provider.status))}
        ${metricCell('Overall', `${overallPassed}/${overallTotal}`, `<span style="color:${isFailReport ? '#991b1b' : overallColor};font-weight:700">${escapeHtml((isFailReport ? 'failed' : overall).toUpperCase())}</span>`)}
        ${metricCell('Gaps', `${consumerGaps.length + providerGaps.length}`, `consumer ${consumerGaps.length} · provider ${providerGaps.length}`)}
      </tr>
    </table>

    ${topology}
    ${gapSection}
    ${failureSection}

    <div style="margin:16px 0;padding:14px 16px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff">
      <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8">Interactive dashboard + Excel</p>
      <p style="margin:8px 0 0;font-size:13px;color:#1e40af;line-height:1.45">
        1. Unzip <strong>TaxMesh-Contract-Dashboard.zip</strong><br/>
        2. Open <strong>index.html</strong> (use filter <em>Failed</em> on Provider)<br/>
        3. Compare green <strong>Expected</strong> vs red <strong>Actual</strong> cells<br/>
        4. Optional: open the multi-sheet <strong>TaxMesh-Contract-Report.xlsx</strong> attachment
      </p>
    </div>

    <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;text-align:center">TaxMesh Pact contract pipeline · do not reply to this automated message</p>
  </div>
</body></html>`;
}
