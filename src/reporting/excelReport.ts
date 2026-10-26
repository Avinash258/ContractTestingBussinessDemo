import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import type { PactReport } from './types';

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | undefined | null>>
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row.map((cell) => (cell === undefined || cell === null ? '' : cell)));
  }
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = Math.min(len, 60);
    });
    col.width = max + 2;
  });
  return sheet;
}

function topSlowRows(
  rows: Array<{ label: string; endpoint: string; durationMs: number; status: string }>,
  limit = 10
) {
  return [...rows]
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    .slice(0, limit);
}

/** Build multi-sheet TaxMesh contract Excel workbook. */
export async function buildExcelWorkbook(report: PactReport): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TaxMesh Pact';
  workbook.created = new Date(report.generatedAt || Date.now());

  const consumer = report.consumer || ({} as PactReport['consumer']);
  const provider = report.provider || ({} as PactReport['provider']);
  const env = report.environment || {};
  const target =
    provider.providerBaseUrl ||
    env.GATEWAY_BASE_URL ||
    env.providerUrl ||
    'n/a';

  addSheet(
    workbook,
    'Summary',
    ['Field', 'Value'],
    [
      ['Project', report.project],
      ['Generated At', report.generatedAt],
      ['Overall Status', report.overallStatus],
      ['Consumer Status', consumer.status],
      ['Consumer Passed', consumer.passed],
      ['Consumer Failed', consumer.failed],
      ['Consumer Total', consumer.total],
      ['Consumer Duration Ms', consumer.durationMs],
      ['Provider Status', provider.status],
      ['Provider Passed', provider.passed],
      ['Provider Failed', provider.failed],
      ['Provider Total', provider.total],
      ['Provider Duration Ms', provider.durationMs],
      ['Target URL', target],
      ['Build ID', env.BUILD_BUILDID || ''],
      ['Branch', env.BUILD_SOURCEBRANCH || ''],
      ['Commit', env.BUILD_SOURCEVERSION || env.BUILD_SOURCEVERSIONMESSAGE || ''],
      ['Pact Files', (report.pactFiles || []).length],
      ['Services Healthy', report.serviceMap?.summary?.healthy ?? ''],
      ['Services Failed', report.serviceMap?.summary?.failed ?? ''],
    ]
  );

  addSheet(
    workbook,
    'Service Health',
    [
      'Service',
      'Layer',
      'Status',
      'Passed',
      'Failed',
      'Total',
    ],
    (report.serviceMap?.nodes || []).map((node) => [
      node.id,
      node.layer || '',
      node.status,
      node.passed,
      node.failed,
      node.total,
    ])
  );

  addSheet(
    workbook,
    'CT Matrix',
    ['CT ID', 'From', 'To', 'Status'],
    (report.serviceMap?.contractEdges || []).map((edge) => [
      edge.id || '',
      edge.from,
      edge.to,
      edge.status || '',
    ])
  );

  addSheet(
    workbook,
    'Consumer Tests',
    ['Suite', 'Name', 'Endpoint', 'Status', 'DurationMs', 'Reason'],
    (consumer.tests || consumer.interactions || []).map((test: any) => [
      test.suite ? path.basename(String(test.suite)) : test.provider || '',
      test.name || test.description || '',
      test.endpoint || '',
      test.status,
      test.durationMs ?? 0,
      test.status === 'failed' ? test.reason || '' : '',
    ])
  );

  addSheet(
    workbook,
    'Provider Interactions',
    [
      'Provider',
      'Consumer',
      'PactFile',
      'Description',
      'Endpoint',
      'Status',
      'Expected',
      'Actual',
      'DurationMs',
    ],
    (provider.interactions || []).map((item) => [
      item.provider || '',
      item.consumer || '',
      item.pactFile || '',
      item.description || '',
      item.endpoint || '',
      item.status,
      item.expected || '',
      item.actual || '',
      item.durationMs ?? 0,
    ])
  );

  const failureRows: Array<Array<string | number>> = [];
  for (const failure of consumer.failures || []) {
    failureRows.push([
      'Consumer',
      failure.endpoint || '',
      failure.test || '',
      'Pass',
      failure.reason || '',
      '',
    ]);
  }
  for (const failure of provider.failures || []) {
    const details = (failure.details || [])
      .map((d) =>
        d.path
          ? `${d.path}: expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`
          : ''
      )
      .filter(Boolean)
      .join('; ');
    failureRows.push([
      'Provider',
      failure.endpoint || '',
      failure.interaction || '',
      '',
      failure.reason || '',
      details,
    ]);
  }
  for (const ix of provider.interactions || []) {
    if (ix.status !== 'failed') continue;
    failureRows.push([
      'Provider',
      ix.endpoint || '',
      ix.description || '',
      ix.expected || '',
      ix.actual || ix.reason || '',
      '',
    ]);
  }
  addSheet(
    workbook,
    'Failures',
    ['Phase', 'Endpoint', 'Name', 'Expected', 'Actual', 'Details'],
    failureRows.length ? failureRows : [['—', 'No failures', '', '', '', '']]
  );

  addSheet(
    workbook,
    'Pact Files',
    ['FileName', 'Consumer', 'Provider', 'Interactions'],
    (report.pactFiles || []).map((file) => {
      const matching = (provider.interactions || []).filter((ix) => ix.pactFile === file);
      const consumerName =
        matching[0]?.consumer ||
        String(file).replace(/\.json$/i, '').split('-TaxMesh-')[0] ||
        '';
      const providerName =
        matching[0]?.provider ||
        (String(file).includes('-TaxMesh-')
          ? `TaxMesh-${String(file).split('-TaxMesh-').pop()?.replace(/\.json$/i, '')}`
          : '');
      return [file, consumerName, providerName, matching.length || ''];
    })
  );

  const slowConsumer = topSlowRows(
    (consumer.tests || consumer.interactions || []).map((t: any) => ({
      label: t.name || t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    }))
  );
  const slowProvider = topSlowRows(
    (provider.interactions || []).map((t) => ({
      label: t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    }))
  );
  addSheet(
    workbook,
    'Top Slow',
    ['Phase', 'Endpoint', 'Name', 'DurationMs', 'Status'],
    [
      ...slowConsumer.map((r) => ['Consumer', r.endpoint, r.label, r.durationMs, r.status]),
      ...slowProvider.map((r) => ['Provider', r.endpoint, r.label, r.durationMs, r.status]),
    ]
  );

  addSheet(
    workbook,
    'Environment',
    ['Key', 'Value'],
    Object.entries(env).map(([key, value]) => [key, value])
  );

  const coveragePath = path.resolve(process.cwd(), 'reports', 'swagger-coverage.json');
  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const rows = (coverage.rows || coverage.ops || coverage.operations || []).map((row: any) => [
        row.method || row.httpMethod || '',
        row.path || row.endpoint || '',
        row.status || row.coverage || '',
        row.note || row.notes || row.reason || '',
        row.operationId || row.op || '',
      ]);
      if (rows.length) {
        addSheet(workbook, 'Coverage', ['Method', 'Path', 'Status', 'Notes', 'Operation'], rows);
      }
    } catch {
      // optional sheet
    }
  }

  return workbook;
}

export async function writeExcelReport(
  report: PactReport,
  outputPath?: string
): Promise<string> {
  const out =
    outputPath ||
    path.join(process.cwd(), 'reports', 'TaxMesh-Contract-Report.xlsx');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const workbook = await buildExcelWorkbook(report);
  await workbook.xlsx.writeFile(out);
  return out;
}
