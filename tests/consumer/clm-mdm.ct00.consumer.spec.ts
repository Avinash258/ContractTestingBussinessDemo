import { createClmPact } from '../../src/pact/pactFactory';
import { ClmClient } from '../../src/clients/clmClient';
import { config } from '../../src/config';
import {
  clmContractsCatalogBody,
  clmDownstreamMdmBody,
  clmHealthBody,
  ct00EngagementBody,
} from '../../src/matchers/ct00';
import {
  clmContractsCatalogFixture,
  clmDownstreamMdmFixture,
  clmHealthFixture,
  engagementFixture,
} from '../../src/fixtures/engagement';
import { testDefaults } from '../../src/testdata';

/**
 * Consumer-driven contracts: MDM expects these shapes from CLM.
 * Generates pact file under ./pacts for later provider verification.
 * Example values come from /testdata JSON (not hardcoded here).
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
        expect(health.status).toBe(clmHealthFixture.status);
        expect(health.produced).toContain(clmHealthFixture.produced[0]);
      });
  });

  it('GET /contracts — CLM lists CT-00 produced for MDM', async () => {
    const expected = clmContractsCatalogFixture.produced[0];
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
        expect(catalog.service.id).toBe(clmContractsCatalogFixture.service.id);
        expect(
          catalog.produced.some(
            (c) => c.id === expected.id && c.consumer === expected.consumer
          )
        ).toBe(true);
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

        expect(body.contractId).toBe(engagementFixture.contractId);
        expect(body.producer).toBe(engagementFixture.producer);
        expect(body.consumer).toBe(engagementFixture.consumer);
        expect(body.direction).toBe(engagementFixture.direction);
        expect(body.engagementId).toBeTruthy();
        expect(body.clientId).toBeTruthy();
        expect(body.projectId).toBeTruthy();
        expect(body.entityGroupId).toBeTruthy();
        expect(body.jobId).toBeTruthy();
        expect(body.taxYear).toBeGreaterThan(testDefaults.minTaxYear);
        expect(body.formType).toBe(engagementFixture.formType);
      });
  });

  it('GET /downstream/MDM — CLM publishes CT-00 on the CLM→MDM edge', async () => {
    const edge = clmDownstreamMdmFixture;
    await pact
      .addInteraction()
      .given('CLM has downstream contracts to MDM')
      .uponReceiving('an MDM request for CLM downstream payloads to MDM')
      .withRequest('GET', `/downstream/${edge.peer}`, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmDownstreamMdmBody());
      })
      .executeTest(async (mockServer) => {
        const client = new ClmClient(mockServer.url);
        const result = await client.getDownstreamToMdm();
        expect(result.service).toBe(edge.service);
        expect(result.peer).toBe(edge.peer);
        expect(result.flow).toBe(edge.flow);
        expect(result.contracts[0].id).toBe(edge.contracts[0].id);
        expect(result.payloads[0].contractId).toBe(engagementFixture.contractId);
      });
  });
});
