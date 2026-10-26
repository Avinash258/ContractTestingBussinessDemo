import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct01EntitiesBody,
  mdmDownstreamPeerBody,
  mdmHealthBody,
} from '../../src/matchers/mdm';

describe('ACC ← MDM contracts (CT-01)', () => {
  const ct = config.mdm.contracts.ct01;
  const pact = createMdmPact(ct.consumer);

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
        expect(health.status).toBe('ok');
        expect(health.produced).toContain('CT-01');
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
        expect(body.contractId).toBe('CT-01');
        expect(body.producer).toBe('MDM');
        expect(body.consumer).toBe('ACC');
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
      .withRequest('GET', '/downstream/ACC', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody('ACC', 'CT-01', ct01EntitiesBody())
        );
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const edge = await client.getDownstream('ACC');
        expect(edge.service).toBe('MDM');
        expect(edge.peer).toBe('ACC');
        expect(edge.contracts[0].id).toBe('CT-01');
      });
  });
});
