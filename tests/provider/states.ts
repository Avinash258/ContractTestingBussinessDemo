import {
  CONTRACTS,
  SERVICES,
  uniqueFlowPairs,
  type ServiceId,
} from '../../src/catalog/contracts';
import { config } from '../../src/config';

const CLM_SEED_WORKBOOK = '/testdata/set-01/clm.xlsx';

/** Upload a demo CLM workbook only when no complete engagement is loaded. */
async function ensureClmEngagement(): Promise<void> {
  const clmBase = config.serviceBaseUrl('CLM');
  const current = await fetch(`${clmBase}/v2/engagement`, {
    headers: { Accept: 'application/json' },
  });
  const body = (await current.json().catch(() => null)) as any;
  const e = body?.engagement;
  if (current.ok && e?.engagementId && e?.entityName && e?.taxYear) return;

  const xlsx = await fetch(`${config.gatewayBaseUrl}${CLM_SEED_WORKBOOK}`);
  if (!xlsx.ok) {
    throw new Error(`Cannot download ${CLM_SEED_WORKBOOK}: HTTP ${xlsx.status}`);
  }
  const form = new FormData();
  form.append('file', new Blob([await xlsx.arrayBuffer()]), 'clm.xlsx');
  const uploaded = await fetch(`${clmBase}/upload`, { method: 'POST', body: form });
  if (!uploaded.ok) {
    throw new Error(`CLM upload for provider state failed: HTTP ${uploaded.status}`);
  }
}

/** Build permissive state handlers covering all given()/states used in consumer specs. */
export function buildStateHandlers(): Record<string, () => Promise<void>> {
  const noop = async () => {};
  const handlers: Record<string, () => Promise<void>> = {
    'TaxMesh gateway and services are running': noop,
    'TaxMesh architecture catalog is available': noop,
    'TaxMesh CT catalog is available': noop,
    'TaxMesh data-flow catalog is available': noop,
    'TaxMesh flow edges are available': noop,
    'CLM service is running': noop,
    'CLM produces CT-00 for MDM': noop,
    'CLM has engagement context for MDM': noop,
    'CLM has downstream contracts to MDM': noop,
    'MDM service is running': noop,
    'MDM has entities for ACC': noop,
    'MDM has downstream contracts to ACC': noop,
    'MDM has tax attributes for TAX': noop,
    'MDM has downstream contracts to TAX': noop,
    'MDM has ownership for ALC': noop,
    'MDM has downstream contracts to ALC': noop,
    'MDM has filing metadata for DOC': noop,
    'MDM has downstream contracts to DOC': noop,
    'MDM has entity E-100': noop,
    'MDM has ownership for E-100': noop,
    'MDM does not have entity E-999': noop,
    'MDM has partners list': noop,
    'CLM has engagement ENG-200': noop,
    'CLM has an uploaded engagement': ensureClmEngagement,
    'MDM is running': noop,
    'CLM has no upstream contracts to MDM': noop,
    'DOC has no downstream contracts to MDM': noop,
    'MDM has no upstream contracts to ACC': noop,
  };

  for (const ct of CONTRACTS) {
    handlers[`${ct.producer} produces ${ct.id} for ${ct.consumer}`] = noop;
    handlers[
      `${ct.producer} has downstream contracts to ${ct.consumer}`
    ] = noop;
    handlers[
      `${ct.producer} has upstream contracts to ${ct.consumer}`
    ] = noop;
  }

  for (const pair of uniqueFlowPairs('downstream')) {
    handlers[`downstream edge ${pair.from} to ${pair.to} exists`] = noop;
  }
  for (const pair of uniqueFlowPairs('reverse')) {
    handlers[`upstream edge ${pair.from} to ${pair.to} exists`] = noop;
  }

  for (const id of Object.keys(SERVICES) as ServiceId[]) {
    handlers[`${id} service is running for discovery`] = noop;
    handlers[`${id} contract catalog is available`] = noop;
    handlers[`${id} flow summary is available`] = noop;
    handlers[`${id} downstream contracts list is available`] = noop;
    handlers[`${id} upstream contracts list is available`] = noop;
    handlers[`${id} pipeline probe is available`] = noop;
    handlers[`${id} consume/downstream is available`] = noop;
    handlers[`${id} consume/upstream is available`] = noop;
  }

  const filingGets = [
    '/api/filing',
    '/api/filing/datasets',
    '/api/filing/gates',
    '/api/filing/jobs',
    '/api/filing/form1065',
    '/api/filing/validate/tax',
    '/api/filing/validate/alc',
  ];
  for (const path of filingGets) {
    handlers[`filing endpoint ${path} is available`] = noop;
  }

  for (const ct of CONTRACTS) {
    handlers[`contract ${ct.id} exists in catalog`] = noop;
    handlers[
      `${ct.consumer} can consume ${ct.id} from ${ct.producer}`
    ] = noop;
  }

  handlers['filing reset is available'] = noop;
  handlers['filing run-all is available'] = noop;
  handlers['filing tax calculate is available'] = noop;
  handlers['filing alc allocate is available'] = noop;
  handlers['filing run step cem is available'] = noop;
  handlers['filing run step tax is available'] = noop;
  for (const mod of ['clm', 'mdm', 'acc'] as const) {
    handlers[`filing upload ${mod} rejects missing file`] = noop;
  }

  return handlers;
}
