import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import type { PactReport } from './types';

/** Shared colour palette used across every sheet (and mirrored in the HTML dashboard). */
export const PALETTE = {
  passed: { fill: 'DCFCE7', font: '166534' },
  covered: { fill: 'DCFCE7', font: '166534' },
  healthy: { fill: 'DCFCE7', font: '166534' },
  failed: { fill: 'FEE2E2', font: '991B1B' },
  error: { fill: 'FEE2E2', font: '991B1B' },
  skipped: { fill: 'FEF3C7', font: '92400E' },
  unknown: { fill: 'FEF3C7', font: '92400E' },
  deferred: { fill: 'E0E7FF', font: '3730A3' },
  partial: { fill: 'FFEDD5', font: '9A3412' },
  neutral: { fill: 'F1F5F9', font: '334155' },
  header: { fill: '1E293B', font: 'FFFFFF' },
  headerFail: { fill: '7F1D1D', font: 'FFFFFF' },
  zebra: 'F8FAFC',
  failRow: 'FEF2F2',
  border: 'E2E8F0',
  labelCol: 'F1F5F9',
  method: {
    GET: '1D4ED8',
    POST: '15803D',
    PUT: 'B45309',
    PATCH: '7C3AED',
    DELETE: 'B91C1C',
  } as Record<string, string>,
  layer: {
    presentation: 'E0F2FE',
    gateway: 'EDE9FE',
    service: 'ECFCCB',
  } as Record<string, string>,
  service: {
    CLM: 'FDE68A',
    MDM: 'BFDBFE',
    ACC: 'BBF7D0',
    TAX: 'FBCFE8',
    ALC: 'DDD6FE',
    DOC: 'FED7AA',
    Gateway: 'E2E8F0',
    Client: 'CFFAFE',
  } as Record<string, string>,
  phase: {
    Consumer: 'DBEAFE',
    Provider: 'FCE7F3',
  } as Record<string, string>,
} as const;

const SUITE_PASTELS = [
  'DBEAFE',
  'DCFCE7',
  'FEF3C7',
  'FCE7F3',
  'E0E7FF',
  'FFEDD5',
  'CCFBF1',
  'EDE9FE',
  'FECACA',
  'E0F2FE',
  'F3E8FF',
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: `FF${PALETTE.border}` } },
  left: { style: 'thin', color: { argb: `FF${PALETTE.border}` } },
  bottom: { style: 'thin', color: { argb: `FF${PALETTE.border}` } },
  right: { style: 'thin', color: { argb: `FF${PALETTE.border}` } },
};

export interface CoverageSheetRow {
  method: string;
  path: string;
  status: string;
  notes: string;
  operation: string;
  originalStatus?: string;
}

type CellValue = string | number | Date | null | undefined;

function argb(hex: string): string {
  return `FF${hex.replace(/^#/, '').toUpperCase()}`;
}

function fillSolid(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } };
}

function statusStyle(status: string): { fill: string; font: string } {
  const key = String(status || '')
    .toLowerCase()
    .trim() as keyof typeof PALETTE;
  const entry = PALETTE[key];
  if (entry && typeof entry === 'object' && 'fill' in entry) {
    return entry as { fill: string; font: string };
  }
  return PALETTE.unknown;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function suiteFill(suite: string): string {
  return SUITE_PASTELS[hashString(suite) % SUITE_PASTELS.length];
}

function serviceFill(name: string): string | undefined {
  if (!name) return undefined;
  if (PALETTE.service[name]) return PALETTE.service[name];
  const upper = name.toUpperCase();
  for (const key of Object.keys(PALETTE.service)) {
    if (upper.includes(key.toUpperCase())) return PALETTE.service[key];
  }
  return undefined;
}

function parseMethod(endpoint: string): string {
  const m = String(endpoint || '')
    .trim()
    .match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i);
  return m ? m[1].toUpperCase() : '';
}

function estimateLines(text: string, widthChars: number): number {
  const value = String(text ?? '');
  if (!value) return 1;
  const parts = value.split(/\r?\n/);
  let lines = 0;
  for (const part of parts) {
    lines += Math.max(1, Math.ceil(Math.max(part.length, 1) / Math.max(widthChars, 8)));
  }
  return lines;
}

function applyPrintSetup(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
    printTitlesRow: '1:1',
  };
  sheet.headerFooter.oddFooter = 'Page &P of &N - TaxMesh Contract Report';
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, colCount: number, failHeader = false) {
  const row = sheet.getRow(1);
  row.height = 24;
  row.font = {
    bold: true,
    color: { argb: argb(failHeader ? PALETTE.headerFail.font : PALETTE.header.font) },
    name: 'Calibri',
    size: 11,
  };
  row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  row.fill = fillSolid(failHeader ? PALETTE.headerFail.fill : PALETTE.header.fill);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.border = {
      ...THIN_BORDER,
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
    cell.fill = fillSolid(failHeader ? PALETTE.headerFail.fill : PALETTE.header.fill);
    cell.font = row.font;
    cell.alignment = row.alignment;
  }
}

function applyStatusCell(cell: ExcelJS.Cell, status: string) {
  const style = statusStyle(status);
  cell.fill = fillSolid(style.fill);
  cell.font = { bold: true, color: { argb: argb(style.font) }, name: 'Calibri', size: 11 };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
}

function applyDataCell(
  cell: ExcelJS.Cell,
  opts: {
    wrap?: boolean;
    align?: 'left' | 'right' | 'center';
    zebra?: boolean;
    numFmt?: string;
  } = {}
) {
  cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } };
  cell.alignment = {
    vertical: 'top',
    horizontal: opts.align || 'left',
    wrapText: !!opts.wrap,
  };
  cell.border = THIN_BORDER;
  if (opts.zebra) cell.fill = fillSolid(PALETTE.zebra);
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function autoFitRows(
  sheet: ExcelJS.Worksheet,
  wrapCols: Array<{ col: number; width: number }>,
  startRow = 2,
  maxHeight = 300
) {
  const last = sheet.rowCount;
  for (let r = startRow; r <= last; r += 1) {
    const row = sheet.getRow(r);
    let maxLines = 1;
    for (const { col, width } of wrapCols) {
      const raw = row.getCell(col).value;
      const text =
        raw && typeof raw === 'object' && 'text' in (raw as object)
          ? String((raw as ExcelJS.CellHyperlinkValue).text ?? '')
          : String(raw ?? '');
      maxLines = Math.max(maxLines, estimateLines(text, width));
    }
    row.height = Math.min(maxHeight, Math.max(18, maxLines * 15));
  }
}

function addStatusConditionalRules(sheet: ExcelJS.Worksheet, colLetter: string, rowCount: number) {
  if (rowCount < 2) return;
  const range = `${colLetter}2:${colLetter}${rowCount}`;
  const rules: Array<{ type: string; fill: string; font: string }> = [
    { type: 'passed', fill: PALETTE.passed.fill, font: PALETTE.passed.font },
    { type: 'covered', fill: PALETTE.covered.fill, font: PALETTE.covered.font },
    { type: 'healthy', fill: PALETTE.healthy.fill, font: PALETTE.healthy.font },
    { type: 'failed', fill: PALETTE.failed.fill, font: PALETTE.failed.font },
    { type: 'error', fill: PALETTE.error.fill, font: PALETTE.error.font },
    { type: 'skipped', fill: PALETTE.skipped.fill, font: PALETTE.skipped.font },
    { type: 'unknown', fill: PALETTE.unknown.fill, font: PALETTE.unknown.font },
    { type: 'deferred', fill: PALETTE.deferred.fill, font: PALETTE.deferred.font },
    { type: 'partial', fill: PALETTE.partial.fill, font: PALETTE.partial.font },
  ];
  for (const rule of rules) {
    sheet.addConditionalFormatting({
      ref: range,
      rules: [
        {
          type: 'expression',
          formulae: [`LOWER(TRIM($${colLetter}2))="${rule.type}"`],
          style: {
            fill: fillSolid(rule.fill),
            font: { bold: true, color: { argb: argb(rule.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
      ],
    });
  }
}

function addZeroFailConditional(sheet: ExcelJS.Worksheet, colLetter: string, rowCount: number) {
  if (rowCount < 2) return;
  const range = `${colLetter}2:${colLetter}${rowCount}`;
  sheet.addConditionalFormatting({
    ref: range,
    rules: [
      {
        type: 'cellIs',
        operator: 'equal',
        formulae: ['0'],
        style: {
          fill: fillSolid(PALETTE.passed.fill),
          font: { bold: true, color: { argb: argb(PALETTE.passed.font) } },
        },
      } as unknown as ExcelJS.ConditionalFormattingRule,
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['0'],
        style: {
          fill: fillSolid(PALETTE.failed.fill),
          font: { bold: true, color: { argb: argb(PALETTE.failed.font) } },
        },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function addDurationColourScale(
  sheet: ExcelJS.Worksheet,
  colLetter: string,
  rowCount: number,
  values: number[]
) {
  if (rowCount < 2 || !values.length) return;
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return;
  const min = percentile(sorted, 0);
  const mid = percentile(sorted, 50);
  const max = Math.max(percentile(sorted, 95), mid + 1);
  sheet.addConditionalFormatting({
    ref: `${colLetter}2:${colLetter}${rowCount}`,
    rules: [
      {
        type: 'colorScale',
        cfvo: [
          { type: 'num', value: min },
          { type: 'num', value: mid },
          { type: 'num', value: max },
        ],
        color: [{ argb: 'FF86EFAC' }, { argb: 'FFFDE68A' }, { argb: 'FFFCA5A5' }],
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function addDataBar(
  sheet: ExcelJS.Worksheet,
  colLetter: string,
  rowCount: number,
  colorHex: string
) {
  if (rowCount < 2) return;
  sheet.addConditionalFormatting({
    ref: `${colLetter}2:${colLetter}${rowCount}`,
    rules: [
      {
        type: 'dataBar',
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: { argb: argb(colorHex) },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });
}

function topSlowRows(
  rows: Array<{ label: string; endpoint: string; durationMs: number; status: string }>,
  limit = 10
) {
  return [...rows]
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    .slice(0, limit);
}

function suggestedNextStep(phase: string, reason: string): string {
  const text = `${phase} ${reason}`.toLowerCase();
  if (text.includes('state') || text.includes('provider state')) {
    return 'Check provider state setup / fixtures';
  }
  if (text.includes('schema') || text.includes('body') || text.includes('matcher')) {
    return 'Check contract schema or body matcher change';
  }
  if (text.includes('status') || text.includes('http')) {
    return 'Compare expected vs actual HTTP status and route';
  }
  if (text.includes('timeout') || text.includes('econn')) {
    return 'Check target URL reachability and timeouts';
  }
  if (phase === 'Consumer') return 'Re-run consumer test and inspect mock interaction';
  return 'Inspect provider verification mismatch details';
}

function formatMismatchSide(value: string, kind: 'expected' | 'actual'): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^matched$/i.test(raw)) return 'Matched';
  if (raw.includes('\n') || raw.includes('status:') || raw.includes('body')) return raw;
  return `${kind === 'expected' ? 'expected' : 'actual'}: ${raw}`;
}

function mismatchDetail(expected: string, actual: string, reason?: string): string {
  const exp = String(expected || '');
  const act = String(actual || '');
  if (!exp && !act && !reason) return '';
  if (/^matched$/i.test(exp) && /^matched$/i.test(act)) return '';
  if (exp === act && !reason) return '';
  const lines = [
    `status/expected: ${exp || '—'}`,
    `status/actual: ${act || '—'}`,
  ];
  if (reason) lines.push(`reason: ${reason}`);
  return lines.join('\n');
}

/** Load coverage rows; mark upload-only-400 ops as partial. */
export function loadCoverageRows(cwd = process.cwd()): CoverageSheetRow[] {
  const coveragePath = path.resolve(cwd, 'reports', 'swagger-coverage.json');
  if (!fs.existsSync(coveragePath)) return [];
  try {
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const raw = coverage.rows || coverage.ops || coverage.operations || [];
    return raw.map((row: any) => {
      const method = String(row.method || row.httpMethod || '').toUpperCase();
      const endpointPath = String(row.path || row.endpoint || '');
      const notes = String(row.note || row.notes || row.reason || '');
      let status = String(row.status || row.coverage || '').toLowerCase();
      let originalStatus: string | undefined;
      const isUploadPartial =
        /^\/api\/filing\/upload\/(acc|clm|mdm)$/i.test(endpointPath) &&
        /Upload 200 success needs real \.xlsx/i.test(notes);
      if (isUploadPartial && status === 'covered') {
        originalStatus = status;
        status = 'partial';
      }
      return {
        method,
        path: endpointPath,
        status,
        notes: isUploadPartial
          ? `${notes} → reported as partial (400 path covered; 200 upload success still needs real .xlsx).`
          : notes,
        operation: String(row.operationId || row.op || ''),
        originalStatus,
      };
    });
  } catch {
    return [];
  }
}

function createSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  opts: { freezeFirstCol?: boolean; autofilter?: boolean; failHeader?: boolean; tabColor?: string } = {}
) {
  const sheet = workbook.addWorksheet(name.slice(0, 31), {
    properties: opts.tabColor ? { tabColor: { argb: argb(opts.tabColor) } } : {},
    views: [
      {
        state: 'frozen',
        xSplit: opts.freezeFirstCol ? 1 : 0,
        ySplit: 1,
        topLeftCell: opts.freezeFirstCol ? 'B2' : 'A2',
        activeCell: 'A2',
      },
    ],
  });
  sheet.addRow(headers);
  styleHeaderRow(sheet, headers.length, opts.failHeader);
  if (opts.autofilter !== false) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }
  applyPrintSetup(sheet);
  return sheet;
}

function finalizeListSheet(
  sheet: ExcelJS.Worksheet,
  widths: number[],
  wrapCols: number[],
  numberCols: number[],
  statusCols: number[],
  zebra: boolean
) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  const last = sheet.rowCount;
  for (let r = 2; r <= last; r += 1) {
    const row = sheet.getRow(r);
    const isZebra = zebra && r % 2 === 0;
    for (let c = 1; c <= widths.length; c += 1) {
      const cell = row.getCell(c);
      const isStatus = statusCols.includes(c);
      const isNum = numberCols.includes(c);
      const isWrap = wrapCols.includes(c);
      if (isStatus && cell.value != null && cell.value !== '') {
        applyStatusCell(cell, String(cell.value));
        cell.border = THIN_BORDER;
      } else {
        applyDataCell(cell, {
          wrap: isWrap,
          align: isNum ? 'right' : isStatus ? 'center' : 'left',
          zebra: isZebra && !isStatus,
          numFmt: isNum ? '#,##0' : undefined,
        });
      }
    }
  }
  autoFitRows(
    sheet,
    wrapCols.map((col) => ({ col, width: widths[col - 1] || 20 }))
  );
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

  const coverageRows: CoverageSheetRow[] =
    (report.coverage?.rows as CoverageSheetRow[] | undefined)?.length
      ? (report.coverage!.rows as CoverageSheetRow[])
      : loadCoverageRows();

  const coveredCount = coverageRows.filter((r) => r.status === 'covered').length;
  const partialCount = coverageRows.filter((r) => r.status === 'partial').length;
  const deferredCount = coverageRows.filter((r) => r.status === 'deferred').length;
  const coverageTotal = coverageRows.length;
  const coveragePct =
    coverageTotal > 0
      ? Math.round(((coveredCount + partialCount * 0.5) / coverageTotal) * 1000) / 10
      : 0;

  const consumerTests = consumer.tests || consumer.interactions || [];
  const providerIx = provider.interactions || [];
  const slowConsumerAll = topSlowRows(
    consumerTests.map((t: any) => ({
      label: t.name || t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    })),
    1
  );
  const slowProviderAll = topSlowRows(
    providerIx.map((t) => ({
      label: t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    })),
    1
  );

  const failureCount =
    (consumer.failures || []).length +
    (provider.failures || []).length +
    providerIx.filter((ix) => ix.status === 'failed').length;

  // ——— Summary ———
  const summary = createSheet(workbook, 'Summary', ['Field', 'Value'], {
    autofilter: false,
    tabColor: '1E293B',
  });
  const summaryRows: Array<[string, CellValue]> = [
    ['Project', report.project],
    ['Generated At', report.generatedAt ? new Date(report.generatedAt) : new Date()],
    ['Overall Status', report.overallStatus],
    ['Consumer Status', consumer.status],
    ['Consumer Passed', consumer.passed ?? 0],
    ['Consumer Failed', consumer.failed ?? 0],
    ['Consumer Total', consumer.total ?? 0],
    ['Pass Rate Consumer (%)', null],
    ['Consumer Duration Ms', consumer.durationMs ?? 0],
    ['Provider Status', provider.status],
    ['Provider Passed', provider.passed ?? 0],
    ['Provider Failed', provider.failed ?? 0],
    ['Provider Total', provider.total ?? 0],
    ['Pass Rate Provider (%)', null],
    ['Provider Duration Ms', provider.durationMs ?? 0],
    ['Total Duration (s)', null],
    [
      'Slowest Test',
      slowConsumerAll[0]
        ? `${slowConsumerAll[0].label} (${slowConsumerAll[0].durationMs} ms)`
        : 'n/a',
    ],
    [
      'Slowest Provider Interaction',
      slowProviderAll[0]
        ? `${slowProviderAll[0].label} (${slowProviderAll[0].durationMs} ms)`
        : 'n/a',
    ],
    ['Target URL', target],
    ['Build ID', env.BUILD_BUILDID || ''],
    ['Branch', env.BUILD_SOURCEBRANCH || ''],
    ['Commit', env.BUILD_SOURCEVERSION || env.BUILD_SOURCEVERSIONMESSAGE || ''],
    ['Pact Files', (report.pactFiles || []).length],
    ['Services Healthy', report.serviceMap?.summary?.healthy ?? ''],
    ['Services Failed', report.serviceMap?.summary?.failed ?? ''],
    ['Coverage Covered', coveredCount],
    ['Coverage Partial', partialCount],
    ['Coverage Deferred', deferredCount],
    ['Coverage %', null],
  ];
  for (const [field, value] of summaryRows) {
    summary.addRow([field, value === null || value === undefined ? '' : value]);
  }
  summary.getColumn(1).width = 32;
  summary.getColumn(2).width = 70;

  // Row map (1-based data rows start at 2): find by field name
  const summaryFieldRow: Record<string, number> = {};
  for (let r = 2; r <= summary.rowCount; r += 1) {
    summaryFieldRow[String(summary.getRow(r).getCell(1).value)] = r;
  }

  const passConsumerRow = summaryFieldRow['Pass Rate Consumer (%)'];
  const passProviderRow = summaryFieldRow['Pass Rate Provider (%)'];
  const totalDurRow = summaryFieldRow['Total Duration (s)'];
  const covPctRow = summaryFieldRow['Coverage %'];
  const cPassed = summaryFieldRow['Consumer Passed'];
  const cTotal = summaryFieldRow['Consumer Total'];
  const pPassed = summaryFieldRow['Provider Passed'];
  const pTotal = summaryFieldRow['Provider Total'];
  const cDur = summaryFieldRow['Consumer Duration Ms'];
  const pDur = summaryFieldRow['Provider Duration Ms'];
  const covCovered = summaryFieldRow['Coverage Covered'];
  const covPartial = summaryFieldRow['Coverage Partial'];
  const covDeferred = summaryFieldRow['Coverage Deferred'];

  if (passConsumerRow && cPassed && cTotal) {
    summary.getRow(passConsumerRow).getCell(2).value = {
      formula: `IF(B${cTotal}=0,0,ROUND(B${cPassed}/B${cTotal}*100,2))`,
    };
  }
  if (passProviderRow && pPassed && pTotal) {
    summary.getRow(passProviderRow).getCell(2).value = {
      formula: `IF(B${pTotal}=0,0,ROUND(B${pPassed}/B${pTotal}*100,2))`,
    };
  }
  if (totalDurRow && cDur && pDur) {
    summary.getRow(totalDurRow).getCell(2).value = {
      formula: `ROUND((B${cDur}+B${pDur})/1000,2)`,
    };
  }
  if (covPctRow && covCovered && covPartial && covDeferred) {
    // Prefer COUNTIF against Coverage sheet when present; else use stored counts
    summary.getRow(covPctRow).getCell(2).value = {
      formula: `IF((B${covCovered}+B${covPartial}+B${covDeferred})=0,0,ROUND((B${covCovered}+B${covPartial}*0.5)/(B${covCovered}+B${covPartial}+B${covDeferred})*100,1))`,
    };
  }

  for (let r = 2; r <= summary.rowCount; r += 1) {
    const row = summary.getRow(r);
    const field = String(row.getCell(1).value || '');
    const a = row.getCell(1);
    const b = row.getCell(2);
    applyDataCell(a, { wrap: false });
    a.font = { name: 'Calibri', size: 11, bold: true };
    a.fill = fillSolid(PALETTE.labelCol);
    applyDataCell(b, { wrap: true });

    if (field === 'Generated At' && b.value instanceof Date) {
      b.numFmt = 'yyyy-mm-dd hh:mm:ss "UTC"';
    }
    if (field === 'Consumer Duration Ms' || field === 'Provider Duration Ms') {
      b.numFmt = '#,##0 "ms"';
      b.alignment = { horizontal: 'right', vertical: 'top' };
    }
    if (field === 'Commit' && (!b.value || b.value === '')) {
      b.value = 'Not provided';
      b.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF94A3B8' } };
    }
    if (['Overall Status', 'Consumer Status', 'Provider Status'].includes(field)) {
      applyStatusCell(b, String(b.value || ''));
    }
    if (['Consumer Failed', 'Provider Failed', 'Services Failed'].includes(field)) {
      const n = Number(b.value) || 0;
      b.fill = fillSolid(n > 0 ? PALETTE.failed.fill : PALETTE.passed.fill);
      b.font = {
        bold: true,
        color: { argb: argb(n > 0 ? PALETTE.failed.font : PALETTE.passed.font) },
        name: 'Calibri',
        size: 11,
      };
    }
    if (['Consumer Passed', 'Provider Passed', 'Services Healthy'].includes(field)) {
      b.font = { bold: true, color: { argb: argb(PALETTE.passed.font) }, name: 'Calibri', size: 11 };
    }
    if (field.startsWith('Pass Rate')) {
      sheetPassRateStyle(b);
    }
  }
  autoFitRows(summary, [{ col: 2, width: 70 }]);

  // Conditional formats for Summary status + fail counts + pass rates
  for (const field of ['Overall Status', 'Consumer Status', 'Provider Status']) {
    const r = summaryFieldRow[field];
    if (!r) continue;
    summary.addConditionalFormatting({
      ref: `B${r}`,
      rules: (['passed', 'failed', 'skipped', 'unknown'] as const).map(
        (type) =>
          ({
            type: 'expression',
            formulae: [`LOWER(TRIM($B$${r}))="${type}"`],
            style: {
              fill: fillSolid(statusStyle(type).fill),
              font: { bold: true, color: { argb: argb(statusStyle(type).font) } },
            },
          }) as unknown as ExcelJS.ConditionalFormattingRule
      ),
    });
  }
  for (const field of ['Consumer Failed', 'Provider Failed', 'Services Failed']) {
    const r = summaryFieldRow[field];
    if (!r) continue;
    summary.addConditionalFormatting({
      ref: `B${r}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'equal',
          formulae: ['0'],
          style: {
            fill: fillSolid(PALETTE.passed.fill),
            font: { bold: true, color: { argb: argb(PALETTE.passed.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: ['0'],
          style: {
            fill: fillSolid(PALETTE.failed.fill),
            font: { bold: true, color: { argb: argb(PALETTE.failed.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
      ],
    });
  }
  for (const field of ['Pass Rate Consumer (%)', 'Pass Rate Provider (%)']) {
    const r = summaryFieldRow[field];
    if (!r) continue;
    summary.addConditionalFormatting({
      ref: `B${r}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThanOrEqual',
          formulae: ['100'],
          style: {
            fill: fillSolid(PALETTE.passed.fill),
            font: { bold: true, color: { argb: argb(PALETTE.passed.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
        {
          type: 'expression',
          formulae: [`AND(B${r}>=90,B${r}<100)`],
          style: {
            fill: fillSolid(PALETTE.skipped.fill),
            font: { bold: true, color: { argb: argb(PALETTE.skipped.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: ['90'],
          style: {
            fill: fillSolid(PALETTE.failed.fill),
            font: { bold: true, color: { argb: argb(PALETTE.failed.font) } },
          },
        } as unknown as ExcelJS.ConditionalFormattingRule,
      ],
    });
  }

  // ——— Service Health ———
  const health = createSheet(
    workbook,
    'Service Health',
    ['Service', 'Layer', 'Status', 'Passed', 'Failed', 'Total', 'Pass %', 'Avg ms'],
    { autofilter: true, tabColor: '0D9488' }
  );
  for (const node of report.serviceMap?.nodes || []) {
    const endpoints = node.endpoints || [];
    const timed = endpoints; // no per-node avg in map; leave blank if unavailable
    void timed;
    health.addRow([
      node.id,
      node.layer || '',
      node.status,
      node.passed,
      node.failed,
      node.total,
      null,
      '',
    ]);
  }
  for (let r = 2; r <= health.rowCount; r += 1) {
    health.getRow(r).getCell(7).value = {
      formula: `IF(F${r}=0,0,ROUND(D${r}/F${r}*100,1))`,
    };
  }
  finalizeListSheet(health, [14, 14, 12, 12, 12, 12, 12, 12], [2], [4, 5, 6, 7, 8], [3], false);
  for (let r = 2; r <= health.rowCount; r += 1) {
    const layer = String(health.getRow(r).getCell(2).value || '').toLowerCase();
    if (PALETTE.layer[layer]) {
      health.getRow(r).getCell(2).fill = fillSolid(PALETTE.layer[layer]);
    }
    const svc = String(health.getRow(r).getCell(1).value || '');
    const sf = serviceFill(svc);
    if (sf) health.getRow(r).getCell(1).fill = fillSolid(sf);
  }
  addStatusConditionalRules(health, 'C', health.rowCount);
  addZeroFailConditional(health, 'E', health.rowCount);
  addDataBar(health, 'D', health.rowCount, '22C55E');
  addDataBar(health, 'G', health.rowCount, '38BDF8');

  // ——— CT Matrix ———
  const matrix = createSheet(workbook, 'CT Matrix', ['CT ID', 'From', 'To', 'Status'], {
    autofilter: true,
    tabColor: '0D9488',
  });
  for (const edge of report.serviceMap?.contractEdges || []) {
    matrix.addRow([edge.id || '', edge.from, edge.to, edge.status || '']);
  }
  finalizeListSheet(matrix, [12, 14, 14, 12], [], [], [4], false);
  for (let r = 2; r <= matrix.rowCount; r += 1) {
    for (const col of [2, 3]) {
      const sf = serviceFill(String(matrix.getRow(r).getCell(col).value || ''));
      if (sf) matrix.getRow(r).getCell(col).fill = fillSolid(sf);
    }
  }
  addStatusConditionalRules(matrix, 'D', matrix.rowCount);

  // ——— Consumer Tests ———
  const consumerSheet = createSheet(
    workbook,
    'Consumer Tests',
    ['Suite', 'Name', 'Endpoint', 'Method', 'Status', 'DurationMs', 'Reason'],
    { freezeFirstCol: true, autofilter: true, tabColor: '2563EB' }
  );
  const consumerDurations: number[] = [];
  for (const test of consumerTests as any[]) {
    const status = test.status;
    const reason =
      status === 'failed'
        ? String(test.reason || test.failureMessage || 'Failed (no message captured)')
        : '-';
    const endpoint = test.endpoint || '';
    const method = parseMethod(endpoint) || test.method || '';
    consumerDurations.push(Number(test.durationMs) || 0);
    consumerSheet.addRow([
      test.suite ? path.basename(String(test.suite)) : test.provider || '',
      test.name || test.description || '',
      endpoint,
      method,
      status,
      test.durationMs ?? 0,
      reason,
    ]);
  }
  finalizeListSheet(
    consumerSheet,
    [40, 60, 42, 10, 12, 14, 60],
    [1, 2, 3, 7],
    [6],
    [5],
    true
  );
  for (let r = 2; r <= consumerSheet.rowCount; r += 1) {
    const row = consumerSheet.getRow(r);
    const suite = String(row.getCell(1).value || '');
    row.getCell(1).fill = fillSolid(suiteFill(suite));
    const method = String(row.getCell(4).value || '');
    if (PALETTE.method[method]) {
      row.getCell(4).font = {
        bold: true,
        color: { argb: argb(PALETTE.method[method]) },
        name: 'Calibri',
        size: 11,
      };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'top' };
    }
    const status = String(row.getCell(5).value || '');
    if (status === 'failed') {
      for (let c = 1; c <= 7; c += 1) {
        if (c !== 5) row.getCell(c).fill = fillSolid(PALETTE.failRow);
      }
      row.getCell(7).font = {
        name: 'Calibri',
        size: 11,
        color: { argb: argb(PALETTE.failed.font) },
      };
    } else if (String(row.getCell(7).value) === '-') {
      row.getCell(7).font = {
        name: 'Calibri',
        size: 11,
        italic: true,
        color: { argb: 'FF94A3B8' },
      };
    }
  }
  addStatusConditionalRules(consumerSheet, 'E', consumerSheet.rowCount);
  addDurationColourScale(consumerSheet, 'F', consumerSheet.rowCount, consumerDurations);
  consumerSheet.addConditionalFormatting({
    ref: `A2:G${Math.max(2, consumerSheet.rowCount)}`,
    rules: [
      {
        type: 'expression',
        formulae: ['$E2="failed"'],
        style: { fill: fillSolid(PALETTE.failRow) },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });

  // ——— Provider Interactions ———
  const providerSheet = createSheet(
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
      'Mismatch Detail',
      'DurationMs',
    ],
    { freezeFirstCol: true, autofilter: true, tabColor: '2563EB' }
  );
  const providerDurations: number[] = [];
  const pactFileRowIndex = new Map<string, number>();
  for (const item of providerIx) {
    const expected = formatMismatchSide(item.expected || '', 'expected');
    const actual = formatMismatchSide(item.actual || '', 'actual');
    const detail = mismatchDetail(item.expected || '', item.actual || '', item.reason);
    providerDurations.push(Number(item.durationMs) || 0);
    providerSheet.addRow([
      item.provider || '',
      item.consumer || '',
      item.pactFile || '',
      item.description || '',
      item.endpoint || '',
      item.status,
      expected || item.expected || '',
      actual || item.actual || '',
      detail,
      item.durationMs ?? 0,
    ]);
  }
  finalizeListSheet(
    providerSheet,
    [16, 16, 38, 60, 40, 12, 28, 28, 80, 14],
    [3, 4, 5, 7, 8, 9],
    [10],
    [6],
    true
  );
  for (let r = 2; r <= providerSheet.rowCount; r += 1) {
    const row = providerSheet.getRow(r);
    const sf = serviceFill(String(row.getCell(1).value || ''));
    if (sf) row.getCell(1).fill = fillSolid(sf);
    const expected = String(row.getCell(7).value || '');
    const actual = String(row.getCell(8).value || '');
    const matched =
      expected === actual ||
      (/^matched$/i.test(expected) && /^matched$/i.test(actual));
    if (expected || actual) {
      const fill = matched ? PALETTE.passed.fill : PALETTE.failed.fill;
      row.getCell(7).fill = fillSolid(fill);
      row.getCell(8).fill = fillSolid(fill);
    }
    const dur = Number(row.getCell(10).value) || 0;
    if (dur > 500) {
      row.getCell(10).font = {
        bold: true,
        color: { argb: argb(PALETTE.failed.font) },
        name: 'Calibri',
        size: 11,
      };
    }
  }
  addStatusConditionalRules(providerSheet, 'F', providerSheet.rowCount);
  addDurationColourScale(providerSheet, 'J', providerSheet.rowCount, providerDurations);
  providerSheet.addConditionalFormatting({
    ref: `J2:J${Math.max(2, providerSheet.rowCount)}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['500'],
        style: { font: { bold: true, color: { argb: argb(PALETTE.failed.font) } } },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });

  // ——— Failures ———
  const failures = createSheet(
    workbook,
    'Failures',
    [
      'Phase',
      'Endpoint',
      'Name',
      'Expected',
      'Actual',
      'Details',
      'Pact File',
      'Suggested Next Step',
    ],
    {
      autofilter: true,
      failHeader: true,
      tabColor: failureCount ? 'DC2626' : '16A34A',
    }
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
      '',
      suggestedNextStep('Consumer', failure.reason || ''),
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
      '',
      suggestedNextStep('Provider', `${failure.reason || ''} ${details}`),
    ]);
  }
  for (const ix of providerIx) {
    if (ix.status !== 'failed') continue;
    failureRows.push([
      'Provider',
      ix.endpoint || '',
      ix.description || '',
      ix.expected || '',
      ix.actual || ix.reason || '',
      mismatchDetail(ix.expected || '', ix.actual || '', ix.reason),
      ix.pactFile || '',
      suggestedNextStep('Provider', ix.reason || ''),
    ]);
  }
  if (!failureRows.length) {
    failures.addRow([
      'No failures - all contracts verified',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    failures.mergeCells(2, 1, 2, 8);
    const cell = failures.getRow(2).getCell(1);
    cell.fill = fillSolid(PALETTE.passed.fill);
    cell.font = { bold: true, color: { argb: argb(PALETTE.passed.font) }, name: 'Calibri', size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    failures.getRow(2).height = 28;
  } else {
    for (const row of failureRows) failures.addRow(row);
  }
  finalizeListSheet(failures, [12, 40, 40, 24, 24, 80, 38, 40], [1, 2, 3, 4, 5, 6, 7, 8], [], [], false);
  if (failureRows.length) {
    for (let r = 2; r <= failures.rowCount; r += 1) {
      for (let c = 1; c <= 8; c += 1) {
        failures.getRow(r).getCell(c).fill = fillSolid(PALETTE.failRow);
      }
    }
  }

  // ——— Pact Files ———
  const pactSheet = createSheet(
    workbook,
    'Pact Files',
    ['FileName', 'Consumer', 'Provider', 'Interactions'],
    { autofilter: true, tabColor: '2563EB' }
  );
  for (const file of report.pactFiles || []) {
    const matching = providerIx.filter((ix) => ix.pactFile === file);
    const consumerName =
      matching[0]?.consumer ||
      String(file).replace(/\.json$/i, '').split('-TaxMesh-')[0] ||
      '';
    const providerName =
      matching[0]?.provider ||
      (String(file).includes('-TaxMesh-')
        ? `TaxMesh-${String(file).split('-TaxMesh-').pop()?.replace(/\.json$/i, '')}`
        : '');
    pactSheet.addRow([file, consumerName, providerName, matching.length || 0]);
  }
  finalizeListSheet(pactSheet, [42, 22, 22, 14], [1], [4], [], true);
  for (let r = 2; r <= pactSheet.rowCount; r += 1) {
    const file = String(pactSheet.getRow(r).getCell(1).value || '');
    pactFileRowIndex.set(file, r);
    for (const col of [2, 3]) {
      const sf = serviceFill(String(pactSheet.getRow(r).getCell(col).value || ''));
      if (sf) pactSheet.getRow(r).getCell(col).fill = fillSolid(sf);
    }
  }
  addDataBar(pactSheet, 'D', pactSheet.rowCount, '3B82F6');

  // Internal hyperlinks from Provider Interactions → Pact Files
  for (let r = 2; r <= providerSheet.rowCount; r += 1) {
    const file = String(providerSheet.getRow(r).getCell(3).value || '');
    const targetRow = pactFileRowIndex.get(file);
    if (file && targetRow) {
      providerSheet.getRow(r).getCell(3).value = {
        text: file,
        hyperlink: `#'Pact Files'!A${targetRow}`,
      };
      providerSheet.getRow(r).getCell(3).font = {
        name: 'Calibri',
        size: 11,
        color: { argb: 'FF2563EB' },
        underline: true,
      };
    }
  }

  // ——— Top Slow ———
  const slowConsumer = topSlowRows(
    consumerTests.map((t: any) => ({
      label: t.name || t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    }))
  );
  const slowProvider = topSlowRows(
    providerIx.map((t) => ({
      label: t.description || '',
      endpoint: t.endpoint || '',
      durationMs: t.durationMs || 0,
      status: t.status,
    }))
  );
  const slow = createSheet(
    workbook,
    'Top Slow',
    ['Phase', 'Endpoint', 'Name', 'DurationMs', 'Status'],
    { autofilter: true, tabColor: '2563EB' }
  );
  for (const r of slowConsumer) {
    slow.addRow(['Consumer', r.endpoint, r.label, r.durationMs, r.status]);
  }
  for (const r of slowProvider) {
    slow.addRow(['Provider', r.endpoint, r.label, r.durationMs, r.status]);
  }
  finalizeListSheet(slow, [12, 40, 60, 14, 12], [2, 3], [4], [5], false);
  for (let r = 2; r <= slow.rowCount; r += 1) {
    const phase = String(slow.getRow(r).getCell(1).value || '');
    if (PALETTE.phase[phase]) {
      slow.getRow(r).getCell(1).fill = fillSolid(PALETTE.phase[phase]);
    }
    const dur = Number(slow.getRow(r).getCell(4).value) || 0;
    if (dur > 500) {
      slow.getRow(r).getCell(4).font = {
        bold: true,
        color: { argb: argb(PALETTE.failed.font) },
        name: 'Calibri',
        size: 11,
      };
    }
  }
  addStatusConditionalRules(slow, 'E', slow.rowCount);
  addDataBar(slow, 'D', slow.rowCount, 'F97316');
  slow.addConditionalFormatting({
    ref: `D2:D${Math.max(2, slow.rowCount)}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['500'],
        style: { font: { bold: true, color: { argb: argb(PALETTE.failed.font) } } },
      } as unknown as ExcelJS.ConditionalFormattingRule,
    ],
  });

  // ——— Environment ———
  const envSheet = createSheet(workbook, 'Environment', ['Key', 'Value'], {
    autofilter: false,
    tabColor: '64748B',
  });
  for (const [key, value] of Object.entries(env)) {
    envSheet.addRow([key, value]);
  }
  envSheet.getColumn(1).width = 28;
  envSheet.getColumn(2).width = 80;
  for (let r = 2; r <= envSheet.rowCount; r += 1) {
    const row = envSheet.getRow(r);
    const key = String(row.getCell(1).value || '');
    applyDataCell(row.getCell(1), {});
    applyDataCell(row.getCell(2), { wrap: true });
    if (/URL/i.test(key) && String(row.getCell(2).value || '').startsWith('http')) {
      const url = String(row.getCell(2).value);
      row.getCell(2).value = { text: url, hyperlink: url };
      row.getCell(2).font = {
        name: 'Calibri',
        size: 11,
        color: { argb: 'FF2563EB' },
        underline: true,
      };
    }
    if (/^RUN_MODE$|^BUILD_/i.test(key)) {
      row.getCell(1).fill = fillSolid(PALETTE.neutral.fill);
      row.getCell(2).fill = fillSolid(PALETTE.neutral.fill);
    }
  }
  autoFitRows(envSheet, [{ col: 2, width: 80 }]);

  // ——— Coverage ———
  const coverageSheet = createSheet(
    workbook,
    'Coverage',
    ['Method', 'Path', 'Status', 'Notes', 'Operation'],
    { freezeFirstCol: true, autofilter: true, tabColor: '4338CA' }
  );
  for (const row of coverageRows) {
    coverageSheet.addRow([row.method, row.path, row.status, row.notes, row.operation]);
  }
  finalizeListSheet(coverageSheet, [10, 52, 12, 70, 28], [2, 4], [], [3], true);
  for (let r = 2; r <= coverageSheet.rowCount; r += 1) {
    const row = coverageSheet.getRow(r);
    const method = String(row.getCell(1).value || '');
    if (PALETTE.method[method]) {
      row.getCell(1).font = {
        bold: true,
        color: { argb: argb(PALETTE.method[method]) },
        name: 'Calibri',
        size: 11,
      };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    }
    if (String(row.getCell(4).value || '')) {
      row.getCell(4).font = {
        name: 'Calibri',
        size: 11,
        italic: true,
        color: { argb: 'FF64748B' },
      };
    }
  }
  addStatusConditionalRules(coverageSheet, 'C', coverageSheet.rowCount);

  // Update Summary coverage counts from COUNTIF when Coverage sheet exists
  if (covCovered && coverageSheet.rowCount >= 2) {
    summary.getRow(covCovered).getCell(2).value = {
      formula: `COUNTIF(Coverage!C:C,"covered")`,
    };
    summary.getRow(covPartial!).getCell(2).value = {
      formula: `COUNTIF(Coverage!C:C,"partial")`,
    };
    summary.getRow(covDeferred!).getCell(2).value = {
      formula: `COUNTIF(Coverage!C:C,"deferred")`,
    };
  }

  // ——— Legend ———
  const legend = createSheet(
    workbook,
    'Legend',
    ['Colour swatch', 'Meaning', 'Where used'],
    { autofilter: false, tabColor: '94A3B8' }
  );
  const legendRows: Array<[string, string, string, string]> = [
    [PALETTE.passed.fill, 'passed / covered / healthy', 'Status columns, Summary', PALETTE.passed.font],
    [PALETTE.failed.fill, 'failed / error', 'Status columns, Failures', PALETTE.failed.font],
    [PALETTE.skipped.fill, 'skipped / unknown', 'Status columns', PALETTE.skipped.font],
    [PALETTE.deferred.fill, 'deferred', 'Coverage', PALETTE.deferred.font],
    [PALETTE.partial.fill, 'partial', 'Coverage (upload 400-only)', PALETTE.partial.font],
    [PALETTE.neutral.fill, 'neutral info', 'Environment BUILD_*/RUN_MODE', PALETTE.neutral.font],
    ['86EFAC', 'Duration scale — fast (low)', 'Consumer/Provider DurationMs', '166534'],
    ['FDE68A', 'Duration scale — medium', 'Consumer/Provider DurationMs', '92400E'],
    ['FCA5A5', 'Duration scale — slow (high)', 'Consumer/Provider DurationMs', '991B1B'],
  ];
  for (const [fill, meaning, where, font] of legendRows) {
    const row = legend.addRow(['■■■', meaning, where]);
    row.getCell(1).fill = fillSolid(fill);
    row.getCell(1).font = { bold: true, color: { argb: argb(font) }, name: 'Calibri', size: 11 };
    applyDataCell(row.getCell(2), { wrap: true });
    applyDataCell(row.getCell(3), { wrap: true });
  }
  for (const [svc, fill] of Object.entries(PALETTE.service)) {
    const row = legend.addRow(['■■■', `Service: ${svc}`, 'CT Matrix / Service Health / Pact Files']);
    row.getCell(1).fill = fillSolid(fill);
    applyDataCell(row.getCell(2), {});
    applyDataCell(row.getCell(3), { wrap: true });
  }
  legend.getColumn(1).width = 16;
  legend.getColumn(2).width = 40;
  legend.getColumn(3).width = 48;
  autoFitRows(legend, [
    { col: 2, width: 40 },
    { col: 3, width: 48 },
  ]);

  return workbook;
}

function sheetPassRateStyle(cell: ExcelJS.Cell) {
  // Static hint; conditional formatting also applied
  cell.numFmt = '0.00';
  cell.alignment = { horizontal: 'right', vertical: 'top' };
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
