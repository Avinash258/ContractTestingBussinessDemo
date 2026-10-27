import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct01EntitiesBody,
  mdmDownstreamPeerBody,
  mdmHealthBody,
} from '../../src/matchers/mdm';
import {
  ct01EntitiesFixture,
  mdmHealthFixture,
} from '../../src/fixtures/mdm';

describe('ACC ← MDM contracts (CT-01)', () => {
  const ct = config.mdm.contracts.ct01;
  const pact = createMdmPact(ct.consumer);
  const fixture = ct01EntitiesFixture;

  it('GET /health — MDM is live and produces CT-01…CT-04', async () => {
    await pact
      .addInteraction()
      .given('MDM service is running')
      .uponReceiving('an ACC health check against MDM')
      .withRequest('GET', '/health', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(mdmHealthBody());
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const health = await client.getHealth();
        expect(health.status).toBe(mdmHealthFixture.status);
        expect(health.produced).toContain(mdmHealthFixture.produced[0]);
      });
  });

  it('GET /contracts/ct-01/entities — entities for account mapping', async () => {
    await pact
      .addInteraction()
      .given('MDM has entities for ACC')
      .uponReceiving('an ACC request for CT-01 entities')
      .withRequest('GET', ct.path, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(ct01EntitiesBody());
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const body = await client.getEntities();
        expect(body.contractId).toBe(fixture.contractId);
        expect(body.producer).toBe(fixture.producer);
        expect(body.consumer).toBe(fixture.consumer);
        expect(body.entities.length).toBeGreaterThan(0);
        expect(body.entities[0].entityId).toBeTruthy();
        expect(body.entities[0].ein).toBeTruthy();
      });
  });

  it('GET /downstream/ACC — MDM publishes CT-01 on MDM→ACC edge', async () => {
    await pact
      .addInteraction()
      .given('MDM has downstream contracts to ACC')
      .uponReceiving('an ACC request for MDM downstream payloads to ACC')
      .withRequest('GET', `/downstream/${fixture.consumer}`, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody(
            fixture.consumer,
            fixture.contractId,
            ct01EntitiesBody()
          )
        );
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const edge = await client.getDownstream(fixture.consumer);
        expect(edge.service).toBe(fixture.producer);
        expect(edge.peer).toBe(fixture.consumer);
        expect(edge.contracts[0].id).toBe(fixture.contractId);
      });
  });
});
