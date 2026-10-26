import fs from 'fs';
import path from 'path';
import { buildEmailDashboardBody } from '../src/reporting/emailDashboard';
import type { PactReport } from '../src/reporting/types';

const reportPath = path.resolve('reports/pact-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as PactReport;
const html = buildEmailDashboardBody(report, {
  buildId: '999',
  collectionUri: 'https://dev.azure.com/InnoVisionDA/',
  teamProject: 'ContractTesting',
  compact: true,
});
const out = path.resolve('reports/email-preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`Wrote ${out} (${html.length} chars)`);
for (const needle of [
  'TaxMesh Contract Test Report',
  'Microservice map',
  'Interactive dashboard',
  'Pipeline run',
  'Consumer',
  'Provider',
  'Overall',
  'Failed',
]) {
  console.log(`${html.includes(needle) ? 'OK' : 'MISSING'}: ${needle}`);
}
