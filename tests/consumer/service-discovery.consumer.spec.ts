import {
  SERVICES,
  contractsProducedBy,
  type ServiceId,
} from '../../src/catalog/contracts';
import { createServicePairPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { healthBody, contractsCatalogBody } from '../../src/matchers/common';
import { MatchersV3 } from '@pact-foundation/pact';
import { clm, testDefaults } from '../../src/testdata';

const { like, string } = MatchersV3;
const fallbackContractId = clm.engagementContext.contractId;

/**
 * Per-service discovery APIs exposed via /api/proxy/{svc}/… in Swagger:
 * health, contracts, flow, contracts/downstream, contracts/upstream, pipeline
 *
 * Uses the first consumer of each producer as the Pact consumer name.
 */
const producers: ServiceId[] = ['CLM', 'MDM', 'ACC', 'TAX', 'ALC', 'DOC'];

function consumerFor(producer: ServiceId): ServiceId {
  const produced = contractsProducedBy(producer);
  return produced[0]?.consumer ?? 'MDM';
}

describe('TaxMesh service discovery APIs', () => {
  it.each(producers)('%s GET /health', async (producer) => {
    const produced = contractsProducedBy(producer);
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} service is running for discovery`)
      .uponReceiving(`a discovery health check against ${producer}`)
      .withRequest('GET', '/health', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          healthBody(
            SERVICES[producer].key,
            produced[0]?.id ?? fallbackContractId
          )
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(createJsonClient(url), '/health');
        expect(status).toBe(testDefaults.httpOk);
        expect(data.status).toBe(testDefaults.statusOk);
      });
  });

  it.each(producers)('%s GET /contracts', async (producer) => {
    const produced = contractsProducedBy(producer);
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} contract catalog is available`)
      .uponReceiving(`a discovery contracts request against ${producer}`)
      .withRequest('GET', '/contracts', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          contractsCatalogBody(
            producer,
            produced[0]?.id ?? fallbackContractId
          )
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/contracts'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service.id).toBe(producer);
      });
  });

  it.each(producers)('%s GET /flow', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} flow summary is available`)
      .uponReceiving(`a discovery flow request against ${producer}`)
      .withRequest('GET', '/flow', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({ service: string(producer) }));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(createJsonClient(url), '/flow');
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(producer);
      });
  });

  it.each(producers)('%s GET /contracts/downstream', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} downstream contracts list is available`)
      .uponReceiving(`a discovery downstream contracts request against ${producer}`)
      .withRequest('GET', '/contracts/downstream', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            service: string(producer),
            flow: string(testDefaults.flowDownstream),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/contracts/downstream'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.flow).toBe(testDefaults.flowDownstream);
      });
  });

  it.each(producers)('%s GET /contracts/upstream', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} upstream contracts list is available`)
      .uponReceiving(`a discovery upstream contracts request against ${producer}`)
      .withRequest('GET', '/contracts/upstream', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            service: string(producer),
            flow: string(testDefaults.flowUpstream),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/contracts/upstream'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.flow).toBe(testDefaults.flowUpstream);
      });
  });

  it.each(producers)('%s GET /pipeline', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} pipeline probe is available`)
      .uponReceiving(`a discovery pipeline request against ${producer}`)
      .withRequest('GET', '/pipeline', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({ service: string(producer) }));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/pipeline'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(producer);
      });
  });

  it.each(producers)('%s GET /consume/downstream', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} consume/downstream is available`)
      .uponReceiving(`a discovery consume/downstream request against ${producer}`)
      .withRequest('GET', '/consume/downstream', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            service: string(producer),
            flow: string(testDefaults.flowDownstream),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/consume/downstream'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.flow).toBe(testDefaults.flowDownstream);
      });
  });

  it.each(producers)('%s GET /consume/upstream', async (producer) => {
    const pact = createServicePairPact(consumerFor(producer), producer);
    await pact
      .addInteraction()
      .given(`${producer} consume/upstream is available`)
      .uponReceiving(`a discovery consume/upstream request against ${producer}`)
      .withRequest('GET', '/consume/upstream', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            service: string(producer),
            flow: string(testDefaults.flowUpstream),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/consume/upstream'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.flow).toBe(testDefaults.flowUpstream);
      });
  });
});
