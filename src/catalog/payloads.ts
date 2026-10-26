/** Sample producer payloads aligned with TaxMesh shared/payloads.js */

const engagementId = 'ENG-2025-1065-001';
const entityId = 'ENT-ALPHA-LP';

export const PAYLOADS: Record<string, Record<string, unknown>> = {
  'CT-00': {
    contractId: 'CT-00',
    engagementId,
    clientId: 'CLI-NV-TAX-01',
    projectId: 'PRJ-ALPHA-1065-2025',
    entityGroupId: 'EG-ALPHA',
    jobId: 'JOB-TY2025-001',
    taxYear: 2025,
    formType: '1065',
    dueDate: '2026-03-15',
  },
  'CT-01': {
    contractId: 'CT-01',
    engagementId,
    entities: [
      { entityId, legalName: 'Alpha Partners LP', ein: '12-3456789', entityType: 'partnership', taxYear: 2025 },
      { entityId: 'ENT-BETA-LLC', legalName: 'Beta Holdings LLC', ein: '98-7654321', entityType: 'disregarded', taxYear: 2025 },
    ],
  },
  'CT-02': {
    contractId: 'CT-02',
    engagementId,
    entityId,
    taxAttributes: {
      filingType: '1065',
      fiscalYearEnd: '12-31',
      multiState: true,
      states: ['NY', 'CA'],
      section754Election: true,
    },
  },
  'CT-03': {
    contractId: 'CT-03',
    engagementId,
    entityId,
    partners: [
      { partnerId: 'P-001', name: 'Jordan Lee', ownershipPct: 60, capitalAccount: 'CA-001' },
      { partnerId: 'P-002', name: 'Sam Rivera', ownershipPct: 40, capitalAccount: 'CA-002' },
    ],
  },
  'CT-04': {
    contractId: 'CT-04',
    engagementId,
    entityId,
    filingMeta: {
      formSet: ['1065', 'K-1', 'K-3'],
      jurisdiction: 'US-FED',
      printPackageId: null,
      dueDate: '2026-03-15',
    },
  },
  'CT-05': {
    contractId: 'CT-05',
    engagementId,
    gaps: [
      { code: 'MISSING_ENTITY', accountCode: '1700', message: 'No master entity for intercompany account 1700' },
    ],
  },
  'CT-06': {
    contractId: 'CT-06',
    engagementId,
    entityId,
    bookBalances: [
      { accountCode: '4000', accountName: 'Ordinary Income', bookAmount: 1250000, currency: 'USD' },
      { accountCode: '5000', accountName: 'Guaranteed Payments', bookAmount: 80000, currency: 'USD' },
      { accountCode: '1700', accountName: 'Depreciation', bookAmount: -45000, currency: 'USD' },
    ],
  },
  'CT-07': {
    contractId: 'CT-07',
    engagementId,
    entityId,
    capitalMap: [
      { partnerId: 'P-001', capitalAccount: 'CA-001', beginningCapital: 500000, contributions: 0, distributions: 50000 },
      { partnerId: 'P-002', capitalAccount: 'CA-002', beginningCapital: 320000, contributions: 25000, distributions: 20000 },
    ],
  },
  'CT-08': {
    contractId: 'CT-08',
    engagementId,
    entityId,
    attributeGaps: [
      { field: 'section754Election', severity: 'warning', message: 'Confirm 754 election status for tax year' },
    ],
  },
  'CT-09': {
    contractId: 'CT-09',
    engagementId,
    entityId,
    // Live TAX API uses camelCase `bttAsks` (not `bttasks`)
    bttAsks: [
      { accountCode: '1700', ask: 'Provide tax depreciation schedule for book-to-tax', priority: 'high' },
    ],
  },
  'CT-10': {
    contractId: 'CT-10',
    engagementId,
    entityId,
    taxableIncome: {
      ordinaryIncome: 1180000,
      interestIncome: 12000,
      guaranteedPayments: 80000,
      section179: 15000,
      currency: 'USD',
    },
  },
  'CT-11': {
    contractId: 'CT-11',
    engagementId,
    entityId,
    taxSummary: {
      federalTaxableIncome: 1197000,
      stateApportionment: { NY: 0.62, CA: 0.38 },
      status: 'computed',
      version: 'TIM-2025.1',
    },
  },
  'CT-12': {
    contractId: 'CT-12',
    engagementId,
    entityId,
    ownershipIssues: [
      { partnerId: 'P-002', issue: 'Ownership % drift vs capital ratio', suggestedOwnershipPct: 40 },
    ],
  },
  'CT-13': {
    contractId: 'CT-13',
    engagementId,
    entityId,
    allocationNeeds: [
      { bucket: 'ordinaryIncome', requiredAmount: 1180000, reason: 'Special allocation SA-12' },
    ],
  },
  'CT-14': {
    contractId: 'CT-14',
    engagementId,
    entityId,
    partnerAllocations: [
      { partnerId: 'P-001', k1: { ordinaryIncome: 708000, interestIncome: 7200, endingCapital: 658000 } },
      { partnerId: 'P-002', k1: { ordinaryIncome: 472000, interestIncome: 4800, endingCapital: 401000 } },
    ],
  },
  'CT-15': {
    contractId: 'CT-15',
    engagementId,
    entityId,
    printNeeds: [
      { field: 'legalName', required: true },
      { field: 'ein', required: true },
    ],
  },
  'CT-16': {
    contractId: 'CT-16',
    engagementId,
    entityId,
    taxLineNeeds: [
      { form: '1065', line: '22', description: 'Ordinary business income' },
    ],
  },
  'CT-17': {
    contractId: 'CT-17',
    engagementId,
    entityId,
    capitalRestatement: [
      { partnerId: 'P-001', beginning: 500000, ending: 658000, restatementReason: 'Forms package capital rollforward' },
      { partnerId: 'P-002', beginning: 320000, ending: 401000, restatementReason: 'Forms package capital rollforward' },
    ],
  },
};
