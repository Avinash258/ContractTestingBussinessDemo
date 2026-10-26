/** Sample CT-00 engagement context aligned with TaxMesh demo payloads. */
export const engagementFixture = {
  contractId: 'CT-00',
  engagementId: 'ENG-2025-1065-001',
  clientId: 'CLI-NV-TAX-01',
  projectId: 'PRJ-ALPHA-1065-2025',
  entityGroupId: 'EG-ALPHA',
  jobId: 'JOB-TY2025-001',
  taxYear: 2025,
  formType: '1065',
  dueDate: '2026-03-15',
  producer: 'CLM',
  consumer: 'MDM',
  direction: 'downstream',
  flow: 'downstream',
  producedAt: '2025-10-26T10:00:00.000Z',
} as const;

export const clmHealthFixture = {
  status: 'ok',
  service: 'clm',
  produced: ['CT-00'],
  consumed: [] as string[],
} as const;
