import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { PactReport } from './types';
import { packInteractiveDashboardZip } from './dashboardZip';
import { buildEmailDashboardBody } from './emailDashboard';

export async function sendReportEmail(options?: {
  reportPath?: string;
  htmlPath?: string;
  force?: boolean;
}): Promise<{ sent: boolean; reason?: string; to?: string; messageId?: string }> {
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
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
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
  // FinVault default: compact body + zip; attach full HTML/JSON only if requested
  if (process.env.PACT_EMAIL_ATTACH_FULL_REPORT === 'true') {
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
  }

  const buildId = process.env.BUILD_BUILDID;
  const collectionUri =
    process.env.SYSTEM_COLLECTIONURI || process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI || '';
  const teamProject = process.env.SYSTEM_TEAMPROJECT || '';
  const buildUrl =
    process.env.BUILD_URL ||
    process.env.BUILD_BUILDURI ||
    (collectionUri && buildId
      ? `${collectionUri.replace(/\/$/, '')}/${teamProject}/_build/results?buildId=${buildId}`
      : undefined);

  const htmlBody = buildEmailDashboardBody(report, {
    buildId,
    buildUrl: buildUrl && String(buildUrl).startsWith('http') ? buildUrl : '',
    collectionUri,
    teamProject,
    compact: true,
  });

  const status = (report.overallStatus || 'unknown').toUpperCase();
  const subject = `TaxMesh Contract Test Report — ${status}`;
  const target =
    report.provider.providerBaseUrl ||
    report.environment.GATEWAY_BASE_URL ||
    'n/a';
  const text = [
    `TaxMesh Contract Test Report — ${status}`,
    `Target ${target}`,
    `Generated ${report.generatedAt}`,
    '',
    `Consumer ${report.consumer.passed}/${report.consumer.total} ${report.consumer.status}`,
    `Provider ${report.provider.passed}/${report.provider.total} ${report.provider.status}`,
    `Overall ${(report.consumer.passed || 0) + (report.provider.passed || 0)}/${(report.consumer.total || 0) + (report.provider.total || 0)}`,
    buildUrl ? `Pipeline: ${buildUrl}` : '',
    '',
    'Unzip TaxMesh-Contract-Dashboard.zip and open index.html for the interactive map.',
  ]
    .filter(Boolean)
    .join('\n');

  console.log(`SMTP host: ${host}:${port}`);
  console.log(`Report recipients: ${to}`);

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
      html: htmlBody,
      attachments,
    });
    console.log(
      `Report email sent to ${to} with ${attachments.length} attachment(s) (messageId: ${info.messageId})`
    );
    console.log('Email uses FinVault-style compact dashboard body + TaxMesh-Contract-Dashboard.zip.');
    fs.writeFileSync(emailSentMarker, new Date().toISOString(), 'utf8');
    return { sent: true, to, messageId: info.messageId };
  } catch (error: any) {
    // Gmail 552 retry: text + zip only (FinVault pattern)
    const blocked =
      String(error.message || '').includes('552') ||
      String(error.message || '').includes('BlockedMessage');
    if (blocked && attachments.length > 0) {
      try {
        const retry = await transporter.sendMail({
          from: `"TaxMesh Pact" <${from}>`,
          to,
          subject,
          text,
          attachments: attachments.filter((a) => a.filename.endsWith('.zip')),
        });
        console.log(`Report email sent on retry (text + zip): ${retry.messageId}`);
        fs.writeFileSync(emailSentMarker, new Date().toISOString(), 'utf8');
        return { sent: true, to, messageId: retry.messageId };
      } catch (retryErr: any) {
        console.warn(`Retry also failed: ${retryErr.message}`);
      }
    }
    console.warn(`Failed to send report email: ${error.message}`);
    return { sent: false, reason: 'send-failed' };
  }
}
