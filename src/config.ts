import path from 'path';
import { GATEWAY_PACT, SERVICES, type ServiceId } from './catalog/contracts';

/**
 * TaxMesh Pact config — full CT-00…CT-17 + gateway data-flow coverage.
 */
export const config = {
  pactsDir: path.resolve(process.cwd(), 'pacts'),
  logDir: path.resolve(process.cwd(), 'logs'),

  gatewayBaseUrl:
    process.env.GATEWAY_BASE_URL ||
    process.env.TAXMESH_BASE_URL ||
    'http://127.0.0.1:4100',

  gatewayPact: GATEWAY_PACT,

  serviceBaseUrl(serviceId: ServiceId): string {
    const envKey = `URL_${serviceId}`;
    const alt = `${serviceId}_BASE_URL`;
    return (
      process.env[envKey] ||
      process.env[alt] ||
      `http://127.0.0.1:${SERVICES[serviceId].port}`
    );
  },

  // Back-compat for earlier CLM↔MDM helpers
  get clmBaseUrl() {
    return this.serviceBaseUrl('CLM');
  },
  get mdmBaseUrl() {
    return this.serviceBaseUrl('MDM');
  },
  clmMdm: {
    consumer: 'TaxMesh-MDM',
    provider: 'TaxMesh-CLM',
    contract: {
      id: 'CT-00',
      path: '/contracts/ct-00/engagement-context',
      direction: 'downstream' as const,
      producer: 'CLM',
      consumer: 'MDM',
      title: 'Engagement / project / job context',
    },
  },
  mdm: {
    provider: 'TaxMesh-MDM',
    contracts: {
      ct01: {
        consumer: 'TaxMesh-ACC',
        id: 'CT-01',
        path: '/contracts/ct-01/entities',
        peer: 'ACC',
        title: 'Entities for account mapping',
      },
      ct02: {
        consumer: 'TaxMesh-TAX',
        id: 'CT-02',
        path: '/contracts/ct-02/tax-attributes',
        peer: 'TAX',
        title: 'Entity tax attributes',
      },
      ct03: {
        consumer: 'TaxMesh-ALC',
        id: 'CT-03',
        path: '/contracts/ct-03/ownership',
        peer: 'ALC',
        title: 'Partner ownership',
      },
      ct04: {
        consumer: 'TaxMesh-DOC',
        id: 'CT-04',
        path: '/contracts/ct-04/filing-meta',
        peer: 'DOC',
        title: 'Filing metadata',
      },
    },
  },
  get consumer() {
    return this.clmMdm.consumer;
  },
  get provider() {
    return this.clmMdm.provider;
  },
  get contract() {
    return this.clmMdm.contract;
  },
} as const;
