import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { PactReport } from './types';
import { packInteractiveDashboardZip } from './dashboardZip';

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
  return '#a16207';
}

function phaseBadge(status: string): string {
  const color = statusColor(status);
  return `<span style="color:${color};font-weight:700">${escapeHtml(String(status || 'unknown').toUpperCase())}</span>`;
}

/** Compact EY_Demo-style email body (Outlook/Gmail safe, no JS). */
export function buildEmailHtml(report: PactReport, buildUrl?: string): string {
  const consumer = report.consumer;
  const provider = report.provider;
  const overallStatus = report.overallStatus;
  const statusColorValue = statusColor(overallStatus);
  const tableStyle =
    'border-collapse:collapse;font-family:Segoe UI,sans-serif;font-size:14px;width:100%;max-width:720px';
  const cell = 'border:1px solid #dbe3ef;padding:8px 10px;text-align:left;vertical-align:top';
  const header = `${cell};background:#f8fafc;font-weight:600`;

  const serviceRows = (report.serviceMap?.nodes || [])
    .filter((n) => n.layer === 'service' || n.layer === 'gateway')
    .map((node) => {
      const color = statusColor(node.status);
      return `<tr>
        <td style="${cell}">${escapeHtml(node.label)}</td>
        <td style="${cell}"><span style="color:${color};font-weight:700">${escapeHtml(node.status.toUpperCase())}</span></td>
        <td style="${cell}">${node.passed}/${node.total}</td>
        <td style="${cell}">${node.failed}</td>
      </tr>`;
    })
    .join('');

  const failRows = [
    ...(consumer.failures || []).map((f) => ({
      phase: 'Consumer',
      endpoint: f.endpoint || '—',
      name: f.test || '—',
      detail: f.reason || '—',
    })),
    ...(provider.interactions || [])
      .filter((i) => i.status === 'failed')
      .map((i) => ({
        phase: 'Provider',
        endpoint: i.endpoint || '—',
        name: i.description,
        detail: i.reason || i.actual || '—',
      })),
  ]
    .slice(0, 5)
    .map(
      (r) =>
        `<tr><td style="${cell}">${escapeHtml(r.phase)}</td><td style="${cell}">${escapeHtml(r.endpoint)}</td><td style="${cell}">${escapeHtml(r.name)}</td><td style="${cell}">${escapeHtml(r.detail)}</td></tr>`
    )
    .join('');

  const summary = report.serviceMap?.summary;

  return `<div style="font-family:Segoe UI,sans-serif;font-size:14px;color:#1f2937">
  <p style="margin:0 0 4px;font-size:16px;font-weight:700">TaxMesh Pact Contract Test Report</p>
  <p style="margin:0 0 16px;color:#6b7280">Generated: ${escapeHtml(report.generatedAt)}</p>

  <div style="margin:16px 0 20px;padding:16px;border:1px solid #dbe3ef;border-radius:10px;background:#fafcff">
    <p style="margin:0 0 12px;font-size:18px;font-weight:700">
      Overall result: <span style="color:${statusColorValue}">${escapeHtml(overallStatus.toUpperCase())}</span>
    </p>
    <table border="1" cellpadding="0" cellspacing="0" style="${tableStyle}">
      <thead>
        <tr>
          <th style="${header}">Phase</th>
          <th style="${header}">Passed</th>
          <th style="${header}">Failed</th>
          <th style="${header}">Total</th>
          <th style="${header}">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="${cell}"><strong>Consumer</strong></td>
          <td style="${cell}">${consumer.passed}</td>
          <td style="${cell}">${consumer.failed}</td>
          <td style="${cell}">${consumer.total}</td>
          <td style="${cell}">${phaseBadge(consumer.status)}</td>
        </tr>
        <tr>
          <td style="${cell}"><strong>Provider</strong></td>
          <td style="${cell}">${provider.passed}</td>
          <td style="${cell}">${provider.failed}</td>
          <td style="${cell}">${provider.total}</td>
          <td style="${cell}">${phaseBadge(provider.status)}</td>
        </tr>
      </tbody>
    </table>
    <p style="margin:12px 0 0;color:#6b7280;font-size:13px">
      Pact files: <code>${escapeHtml((report.pactFiles || []).join(', ') || 'none')}</code>
      &nbsp;|&nbsp; Verification URL:
      <code>${escapeHtml(provider.providerBaseUrl || report.environment.GATEWAY_BASE_URL || 'n/a')}</code>
    </p>
  </div>

  <p style="font-weight:700;margin:0 0 8px">Pipeline phases</p>
  <table border="1" cellpadding="0" cellspacing="0" style="${tableStyle}">
    <thead>
      <tr>
        <th style="${header}">Phase</th><th style="${header}">Ran</th><th style="${header}">Status</th>
        <th style="${header}">Passed</th><th style="${header}">Failed</th><th style="${header}">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="${cell}"><strong>1. Consumer</strong></td>
        <td style="${cell}">${consumer.ran ? 'Yes' : 'No'}</td>
        <td style="${cell}">${phaseBadge(consumer.status)}</td>
        <td style="${cell}">${consumer.passed}</td>
        <td style="${cell}">${consumer.failed}</td>
        <td style="${cell}">${consumer.total}</td>
      </tr>
      <tr>
        <td style="${cell}"><strong>2. Provider</strong></td>
        <td style="${cell}">${provider.ran ? 'Yes' : 'No'}</td>
        <td style="${cell}">${phaseBadge(provider.status)}</td>
        <td style="${cell}">${provider.passed}</td>
        <td style="${cell}">${provider.failed}</td>
        <td style="${cell}">${provider.total}</td>
      </tr>
    </tbody>
  </table>

  ${
    serviceRows
      ? `<p style="font-weight:700;margin:20px 0 8px">Microservice health</p>
     <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Healthy ${summary?.healthy || 0} · Failed ${summary?.failed || 0} · Untested ${summary?.unknown || 0}. Open the attached dashboard zip for the interactive map.</p>
     <table border="1" cellpadding="0" cellspacing="0" style="${tableStyle}">
       <thead><tr><th style="${header}">Service</th><th style="${header}">Status</th><th style="${header}">Passed/Total</th><th style="${header}">Failed</th></tr></thead>
       <tbody>${serviceRows}</tbody>
     </table>`
      : ''
  }

  ${
    failRows
      ? `<p style="font-weight:700;margin:20px 0 8px">Failure highlights</p>
       <table border="1" cellpadding="0" cellspacing="0" style="${tableStyle}">
         <thead><tr><th style="${header}">Phase</th><th style="${header}">Endpoint</th><th style="${header}">Test</th><th style="${header}">Detail</th></tr></thead>
         <tbody>${failRows}</tbody>
       </table>`
      : ''
  }

  ${buildUrl ? `<p style="margin:16px 0 0"><a href="${escapeHtml(buildUrl)}">View pipeline run</a></p>` : ''}
  <p style="margin:16px 0 0;color:#6b7280">Interactive dashboard attached as <code>TaxMesh-Contract-Dashboard.zip</code> (unzip → open index.html). Full <code>pact-report.html</code> / JSON also attached when available.</p>
</div>`;
}

export async function sendReportEmail(options?: {
  reportPath?: string;
  htmlPath?: string;
  force?: boolean;
}): Promise<{ sent: boolean; reason?: string; to?: string }> {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  const reportPath =
    options?.reportPath ||
    (fs.existsSync(path.join(reportsDir, 'pact-report.json'))
      ? path.join(reportsDir, 'pact-report.json')
      : path.join(reportsDir, 'latest.json'));
  const htmlPath = options?.htmlPath || path.join(reportsDir, 'pact-report.html');
  const emailSentMarker = path.join(reportsDir, '.email-sent');

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}. Run contract tests first.`);
  }

  if (!options?.force && fs.existsSync(emailSentMarker) && process.env.BUILD_BUILDID) {
    console.log('Report email already sent during the test run. Skipping duplicate.');
    return { sent: false, reason: 'already-sent' };
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as PactReport;
  const to = process.env.REPORT_EMAIL_TO || process.env.SMTP_TO;
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = process.env.SMTP_FROM || user;

  if (!to || !user || !pass) {
    console.warn('Set REPORT_EMAIL_TO, SMTP_USER, and SMTP_PASS to send email.');
    return { sent: false, reason: 'missing-smtp-credentials' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
  });

  let dashboardZip = path.join(reportsDir, 'TaxMesh-Contract-Dashboard.zip');
  if (!fs.existsSync(dashboardZip)) {
    try {
      dashboardZip = packInteractiveDashboardZip(report, { outputZip: dashboardZip });
    } catch (e: any) {
      console.warn(`Dashboard zip failed: ${e.message}`);
      dashboardZip = '';
    }
  }

  const attachments: Array<{ filename: string; path: string; contentType?: string }> = [];
  if (dashboardZip && fs.existsSync(dashboardZip)) {
    attachments.push({
      filename: 'TaxMesh-Contract-Dashboard.zip',
      path: dashboardZip,
      contentType: 'application/octet-stream',
    });
  }
  if (fs.existsSync(htmlPath)) {
    attachments.push({ filename: 'pact-report.html', path: htmlPath, contentType: 'text/html' });
  }
  if (fs.existsSync(reportPath)) {
    attachments.push({
      filename: 'pact-report.json',
      path: reportPath,
      contentType: 'application/json',
    });
  }

  const buildUrl =
    process.env.BUILD_URL ||
    (process.env.SYSTEM_COLLECTIONURI && process.env.BUILD_BUILDID
      ? `${process.env.SYSTEM_COLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`
      : undefined);

  const status = (report.overallStatus || 'unknown').toUpperCase();
  const subject = `TaxMesh Pact Contract Test Report — ${status}`;
  const text = [
    `TaxMesh Pact Contract Test Report — ${status}`,
    `Generated: ${report.generatedAt}`,
    `Consumer: ${consumerLine(report)}`,
    `Provider: ${providerLine(report)}`,
    buildUrl ? `Pipeline: ${buildUrl}` : '',
    'Unzip TaxMesh-Contract-Dashboard.zip and open index.html for the interactive map.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await transporter.verify();
  } catch (error: any) {
    console.warn(`SMTP verification failed: ${error.message}`);
    return { sent: false, reason: 'smtp-verify-failed' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"TaxMesh Pact" <${from}>`,
      to,
      subject,
      text,
      html: buildEmailHtml(report, buildUrl),
      attachments,
    });
    console.log(
      `Report email sent to ${to} with ${attachments.length} attachment(s) (messageId: ${info.messageId})`
    );
    fs.writeFileSync(emailSentMarker, new Date().toISOString(), 'utf8');
    return { sent: true, to };
  } catch (error: any) {
    console.warn(`Failed to send report email: ${error.message}`);
    return { sent: false, reason: 'send-failed' };
  }
}

function consumerLine(report: PactReport) {
  return `${report.consumer.status} ${report.consumer.passed}/${report.consumer.total}`;
}
function providerLine(report: PactReport) {
  return `${report.provider.status} ${report.provider.passed}/${report.provider.total}`;
}
