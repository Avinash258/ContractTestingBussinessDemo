import { createClmPact } from '../../src/pact/pactFactory';
import { ClmClient } from '../../src/clients/clmClient';
import { config } from '../../src/config';
import {
  clmContractsCatalogBody,
  clmHealthBody,
  ct00EngagementBody,
} from '../../src/matchers/ct00';
import { MatchersV3 } from '@pact-foundation/pact';

const { like, string, eachLike } = MatchersV3;

/**
 * Consumer-driven contracts: MDM expects these shapes from CLM.
 * Generates pact file under ./pacts for later provider verification.
 */
describe('MDM ← CLM contracts (CT-00)', () => {
  const pact = createClmPact();

  it('GET /health — CLM is live and produces CT-00', async () => {
    await pact
      .addInteraction()
      .given('CLM service is running')
      .uponReceiving('an MDM health check against CLM')
      .withRequest('GET', '/health', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmHealthBody());
      })
      .executeTest(async (mockServer) => {
        const client = new ClmClient(mockServer.url);
        const health = await client.getHealth();
        expect(health.status).toBe('ok');
        expect(health.produced).toContain('CT-00');
      });
  });

  it('GET /contracts — CLM lists CT-00 produced for MDM', async () => {
    await pact
      .addInteraction()
      .given('CLM produces CT-00 for MDM')
      .uponReceiving('an MDM request for CLM contract catalog')
      .withRequest('GET', '/contracts', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmContractsCatalogBody());
      })
      .executeTest(async (mockServer) => {
        const client = new ClmClient(mockServer.url);
        const catalog = await client.getContractsCatalog();
        expect(catalog.service.id).toBe('CLM');
        expect(catalog.produced.some((c) => c.id === 'CT-00' && c.consumer === 'MDM')).toBe(
          true
        );
      });
  });

  it('GET /contracts/ct-00/engagement-context — CT-00 engagement payload', async () => {
    await pact
      .addInteraction()
      .given('CLM has engagement context for MDM')
      .uponReceiving('an MDM request for CT-00 engagement context')
      .withRequest('GET', config.contract.path, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(ct00EngagementBody());
      })
      .executeTest(async (mockServer) => {
        const client = new ClmClient(mockServer.url);
        const body = await client.getEngagementContext();

        expect(body.contractId).toBe('CT-00');
        expect(body.producer).toBe('CLM');
        expect(body.consumer).toBe('MDM');
        expect(body.direction).toBe('downstream');
        expect(body.engagementId).toBeTruthy();
        expect(body.clientId).toBeTruthy();
        expect(body.projectId).toBeTruthy();
        expect(body.entityGroupId).toBeTruthy();
        expect(body.jobId).toBeTruthy();
        expect(body.taxYear).toBeGreaterThan(2000);
        expect(body.formType).toBe('1065');
      });
  });

  it('GET /downstream/MDM — CLM publishes CT-00 on the CLM→MDM edge', async () => {
    await pact
      .addInteraction()
      .given('CLM has downstream contracts to MDM')
      .uponReceiving('an MDM request for CLM downstream payloads to MDM')
      .withRequest('GET', '/downstream/MDM', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          like({
            service: string('CLM'),
            peer: string('MDM'),
            flow: string('downstream'),
            contracts: eachLike(
              like({
                id: string('CT-00'),
                producer: string('CLM'),
                consumer: string('MDM'),
              }),
              1
            ),
            payloads: eachLike(ct00EngagementBody(), 1),
          })
        );
      })
      .executeTest(async (mockServer) => {
        const client = new ClmClient(mockServer.url);
        const edge = await client.getDownstreamToMdm();
        expect(edge.service).toBe('CLM');
        expect(edge.peer).toBe('MDM');
        expect(edge.flow).toBe('downstream');
        expect(edge.contracts[0].id).toBe('CT-00');
        expect(edge.payloads[0].contractId).toBe('CT-00');
      });
  });
});
