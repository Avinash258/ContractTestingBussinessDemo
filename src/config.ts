import path from 'path';
import { GATEWAY_PACT, SERVICES, type ServiceId } from './catalog/contracts';
import { resolveGatewayBaseUrl } from './gatewayConfig';

/**
 * TaxMesh Pact config � full CT-00�CT-17 + gateway data-flow coverage.
 * Live gateway URL: edit gateway.config.json (then npm run sync:gateway).
 */
export const config = {
  pactsDir: path.resolve(process.cwd(), 'pacts'),
  logDir: path.resolve(process.cwd(), 'logs'),

  get gatewayBaseUrl() {
    return resolveGatewayBaseUrl();
  },

  gatewayPact: GATEWAY_PACT,

  /**
   * Per-service provider base URL (Swagger /api-docs).
   * Gateway catalog: GET {GATEWAY}/api/contracts  (operationId: listContracts)
   * Service proxy:   GET {GATEWAY}/api/proxy/{CLM|MDM|ACC|TAX|ALC|DOC}/�
   * @see https://marco-absolute-map-mailto.trycloudflare.com/api-docs#/Gateway/listContracts
   *
   * - URL_CLM / CLM_BASE_URL etc. win when set
   * - Else if GATEWAY_* env set ? `{GATEWAY}/api/proxy/{SERVICE_ID}`
   * - Else local direct ports 4101�4106 (tunnel from gateway.config.json is for CI/Swagger)
   */
  serviceBaseUrl(serviceId: ServiceId): string {
    const envKey = `URL_${serviceId}`;
    const alt = `${serviceId}_BASE_URL`;
    const explicit = process.env[envKey] || process.env[alt];
    if (explicit) return explicit.replace(/\/$/, '');

    const hasGatewayEnv = Boolean(
      process.env.GATEWAY_BASE_URL ||
        process.env.TAXMESH_BASE_URL ||
        process.env.PACT_PROVIDER_URL
    );

    if (hasGatewayEnv) {
      return `${resolveGatewayBaseUrl()}/api/proxy/${serviceId}`;
    }

    return `http://127.0.0.1:${SERVICES[serviceId].port}`;
  },

  // Back-compat for earlier CLM?MDM helpers
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
