import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { PactReport } from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildEmailHtml(report: PactReport, buildUrl?: string): string {
  const statusColor =
    report.overallStatus === 'passed'
      ? '#15803d'
      : report.overallStatus === 'failed'
        ? '#b91c1c'
        : '#a16207';

  return `<!DOCTYPE html>
<html><body style="font-family:Segoe UI,sans-serif;background:#f4f7fb;padding:20px;color:#111827">
  <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:20px">
    <h2 style="margin:0 0 8px">TaxMesh Pact Contract Report</h2>
    <p style="color:#6b7280;margin:0 0 16px">${escapeHtml(report.generatedAt)}</p>
    <p><strong>Overall:</strong> <span style="color:${statusColor};font-weight:700">${escapeHtml(report.overallStatus.toUpperCase())}</span></p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
      <tr>
        <td style="border:1px solid #dbe3ef;padding:8px"><strong>Consumer</strong><br/>${report.consumer.passed}/${report.consumer.total}</td>
        <td style="border:1px solid #dbe3ef;padding:8px"><strong>Provider</strong><br/>${report.provider.passed}/${report.provider.total}</td>
        <td style="border:1px solid #dbe3ef;padding:8px"><strong>Pact files</strong><br/>${report.pactFiles.length}</td>
      </tr>
    </table>
    ${
      buildUrl
        ? `<p><a href="${escapeHtml(buildUrl)}">Open Azure pipeline run</a></p>`
        : ''
    }
    <p style="color:#6b7280;font-size:12px">Full interactive HTML attached as <code>pact-report.html</code>.</p>
  </div>
</body></html>`;
}

export async function sendReportEmail(options?: {
  reportPath?: string;
  htmlPath?: string;
}): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  const reportPath = options?.reportPath || path.join(reportsDir, 'latest.json');
  const htmlPath = options?.htmlPath || path.join(reportsDir, 'pact-report.html');

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}. Run contract tests first.`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as PactReport;
  const to = process.env.REPORT_EMAIL_TO || process.env.SMTP_TO;
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!to || !user || !pass) {
    throw new Error('Set REPORT_EMAIL_TO, SMTP_USER, and SMTP_PASS to send email.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const attachments = [];
  if (fs.existsSync(htmlPath)) {
    attachments.push({
      filename: 'pact-report.html',
      path: htmlPath,
      contentType: 'text/html',
    });
  }

  const buildUrl = process.env.BUILD_URL || process.env.SYSTEM_COLLECTIONURI
    ? `${process.env.SYSTEM_COLLECTIONURI}${process.env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${process.env.BUILD_BUILDID}`
    : undefined;

  await transporter.sendMail({
    from,
    to,
    subject: `[TaxMesh Pact] ${report.overallStatus.toUpperCase()} — consumer ${report.consumer.passed}/${report.consumer.total}, provider ${report.provider.passed}/${report.provider.total}`,
    html: buildEmailHtml(report, buildUrl),
    attachments,
  });

  console.log(`Email report sent to ${to}`);
}
