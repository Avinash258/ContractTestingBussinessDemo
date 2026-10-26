/** Sample MDM producer payloads aligned with TaxMesh `shared/payloads.js`. */

export const mdmHealthFixture = {
  status: 'ok',
  service: 'mdm',
  produced: ['CT-01', 'CT-02', 'CT-03', 'CT-04'],
  consumed: ['CT-00', 'CT-05', 'CT-08', 'CT-12', 'CT-15'],
} as const;

const envelope = {
  producer: 'MDM',
  direction: 'downstream',
  flow: 'downstream',
  producedAt: '2025-10-26T10:00:00.000Z',
} as const;

export const ct01EntitiesFixture = {
  contractId: 'CT-01',
  engagementId: 'ENG-2025-1065-001',
  entities: [
    {
      entityId: 'ENT-ALPHA-LP',
      legalName: 'Alpha Partners LP',
      ein: '12-3456789',
      entityType: 'partnership',
      taxYear: 2025,
    },
    {
      entityId: 'ENT-BETA-LLC',
      legalName: 'Beta Holdings LLC',
      ein: '98-7654321',
      entityType: 'disregarded',
      taxYear: 2025,
    },
  ],
  consumer: 'ACC',
  ...envelope,
} as const;

export const ct02TaxAttributesFixture = {
  contractId: 'CT-02',
  engagementId: 'ENG-2025-1065-001',
  entityId: 'ENT-ALPHA-LP',
  taxAttributes: {
    filingType: '1065',
    fiscalYearEnd: '12-31',
    multiState: true,
    states: ['NY', 'CA'],
    section754Election: true,
  },
  consumer: 'TAX',
  ...envelope,
} as const;

export const ct03OwnershipFixture = {
  contractId: 'CT-03',
  engagementId: 'ENG-2025-1065-001',
  entityId: 'ENT-ALPHA-LP',
  partners: [
    {
      partnerId: 'P-001',
      name: 'Jordan Lee',
      ownershipPct: 60,
      capitalAccount: 'CA-001',
    },
    {
      partnerId: 'P-002',
      name: 'Sam Rivera',
      ownershipPct: 40,
      capitalAccount: 'CA-002',
    },
  ],
  consumer: 'ALC',
  ...envelope,
} as const;

export const ct04FilingMetaFixture = {
  contractId: 'CT-04',
  engagementId: 'ENG-2025-1065-001',
  entityId: 'ENT-ALPHA-LP',
  filingMeta: {
    formSet: ['1065', 'K-1', 'K-3'],
    jurisdiction: 'US-FED',
    printPackageId: null as string | null,
    dueDate: '2026-03-15',
  },
  consumer: 'DOC',
  ...envelope,
} as const;
