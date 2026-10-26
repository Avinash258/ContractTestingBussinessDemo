/** Full TaxMesh CT-00…CT-17 matrix + service ports (aligned with Swagger). */

export type FlowDirection = 'downstream' | 'reverse';

export interface ContractDef {
  id: string;
  producer: ServiceId;
  consumer: ServiceId;
  direction: FlowDirection;
  path: string;
  title: string;
}

export type ServiceId = 'CLM' | 'MDM' | 'ACC' | 'TAX' | 'ALC' | 'DOC';

export const SERVICES: Record<
  ServiceId,
  { port: number; pactProvider: string; key: string; name: string }
> = {
  CLM: { port: 4101, pactProvider: 'TaxMesh-CLM', key: 'clm', name: 'Client Management' },
  MDM: { port: 4102, pactProvider: 'TaxMesh-MDM', key: 'mdm', name: 'Master Data' },
  ACC: { port: 4103, pactProvider: 'TaxMesh-ACC', key: 'acc', name: 'Accounting' },
  TAX: { port: 4104, pactProvider: 'TaxMesh-TAX', key: 'tax', name: 'Tax Computation' },
  ALC: { port: 4105, pactProvider: 'TaxMesh-ALC', key: 'alc', name: 'Allocations' },
  DOC: { port: 4106, pactProvider: 'TaxMesh-DOC', key: 'doc', name: 'Forms & Documents' },
};

export function pactConsumerName(serviceId: ServiceId): string {
  return `TaxMesh-${serviceId}`;
}

export function apiFlow(direction: FlowDirection): 'downstream' | 'upstream' {
  return direction === 'reverse' ? 'upstream' : 'downstream';
}

export const CONTRACTS: ContractDef[] = [
  { id: 'CT-00', producer: 'CLM', consumer: 'MDM', direction: 'downstream', path: '/contracts/ct-00/engagement-context', title: 'Engagement / project / job context' },
  { id: 'CT-01', producer: 'MDM', consumer: 'ACC', direction: 'downstream', path: '/contracts/ct-01/entities', title: 'Entities for account mapping' },
  { id: 'CT-02', producer: 'MDM', consumer: 'TAX', direction: 'downstream', path: '/contracts/ct-02/tax-attributes', title: 'Entity tax attributes' },
  { id: 'CT-03', producer: 'MDM', consumer: 'ALC', direction: 'downstream', path: '/contracts/ct-03/ownership', title: 'Partner ownership' },
  { id: 'CT-04', producer: 'MDM', consumer: 'DOC', direction: 'downstream', path: '/contracts/ct-04/filing-meta', title: 'Filing metadata' },
  { id: 'CT-05', producer: 'ACC', consumer: 'MDM', direction: 'reverse', path: '/contracts/ct-05/mapping-gaps', title: 'Missing entity / account codes' },
  { id: 'CT-06', producer: 'ACC', consumer: 'TAX', direction: 'downstream', path: '/contracts/ct-06/book-balances', title: 'Book account balances' },
  { id: 'CT-07', producer: 'ACC', consumer: 'ALC', direction: 'downstream', path: '/contracts/ct-07/capital-map', title: 'Capital account mappings' },
  { id: 'CT-08', producer: 'TAX', consumer: 'MDM', direction: 'reverse', path: '/contracts/ct-08/attribute-gaps', title: 'Tax attribute corrections' },
  { id: 'CT-09', producer: 'TAX', consumer: 'ACC', direction: 'reverse', path: '/contracts/ct-09/btt-asks', title: 'Book-to-tax reconciling asks' },
  { id: 'CT-10', producer: 'TAX', consumer: 'ALC', direction: 'downstream', path: '/contracts/ct-10/taxable-income', title: 'Taxable income buckets' },
  { id: 'CT-11', producer: 'TAX', consumer: 'DOC', direction: 'downstream', path: '/contracts/ct-11/tax-summary', title: 'Tax computation summary' },
  { id: 'CT-12', producer: 'ALC', consumer: 'MDM', direction: 'reverse', path: '/contracts/ct-12/ownership-issues', title: 'Ownership validation issues' },
  { id: 'CT-13', producer: 'ALC', consumer: 'TAX', direction: 'reverse', path: '/contracts/ct-13/allocation-needs', title: 'Adjusted tax amount needs' },
  { id: 'CT-14', producer: 'ALC', consumer: 'DOC', direction: 'downstream', path: '/contracts/ct-14/partner-allocations', title: 'Partner allocation / K-1 data' },
  { id: 'CT-15', producer: 'DOC', consumer: 'MDM', direction: 'reverse', path: '/contracts/ct-15/entity-print-needs', title: 'Legal name / EIN for forms' },
  { id: 'CT-16', producer: 'DOC', consumer: 'TAX', direction: 'reverse', path: '/contracts/ct-16/tax-line-needs', title: 'Tax line amounts for forms' },
  { id: 'CT-17', producer: 'DOC', consumer: 'ALC', direction: 'reverse', path: '/contracts/ct-17/capital-restatement', title: 'Partner capital restatement' },
];

export const GATEWAY_PACT = {
  consumer: 'TaxMesh-Client',
  provider: 'TaxMesh-Gateway',
} as const;

export function contractsProducedBy(serviceId: ServiceId): ContractDef[] {
  return CONTRACTS.filter((c) => c.producer === serviceId);
}

export function contractsConsumedBy(serviceId: ServiceId): ContractDef[] {
  return CONTRACTS.filter((c) => c.consumer === serviceId);
}

export function uniqueFlowPairs(
  direction: FlowDirection
): Array<{ from: ServiceId; to: ServiceId }> {
  const seen = new Set<string>();
  const pairs: Array<{ from: ServiceId; to: ServiceId }> = [];
  for (const ct of CONTRACTS.filter((c) => c.direction === direction)) {
    const key = `${ct.producer}->${ct.consumer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ from: ct.producer, to: ct.consumer });
  }
  return pairs;
}
