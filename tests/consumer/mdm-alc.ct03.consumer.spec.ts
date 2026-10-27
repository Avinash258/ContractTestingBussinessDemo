import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct03OwnershipBody,
  mdmDownstreamPeerBody,
} from '../../src/matchers/mdm';
import { ct03OwnershipFixture } from '../../src/fixtures/mdm';

describe('ALC ← MDM contracts (CT-03)', () => {
  const ct = config.mdm.contracts.ct03;
  const pact = createMdmPact(ct.consumer);
  const fixture = ct03OwnershipFixture;

  it('GET /contracts/ct-03/ownership — partner ownership', async () => {
    await pact
      .addInteraction()
      .given('MDM has ownership for ALC')
      .uponReceiving('an ALC request for CT-03 ownership')
      .withRequest('GET', ct.path, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(ct03OwnershipBody());
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const body = await client.getOwnership();
        expect(body.contractId).toBe(fixture.contractId);
        expect(body.producer).toBe(fixture.producer);
        expect(body.consumer).toBe(fixture.consumer);
        expect(body.partners.length).toBeGreaterThan(0);
        expect(body.partners[0].partnerId).toBeTruthy();
        expect(typeof body.partners[0].ownershipPct).toBe('number');
      });
  });

  it('GET /downstream/ALC — MDM publishes CT-03 on MDM→ALC edge', async () => {
    await pact
      .addInteraction()
      .given('MDM has downstream contracts to ALC')
      .uponReceiving('an ALC request for MDM downstream payloads to ALC')
      .withRequest('GET', `/downstream/${fixture.consumer}`, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody(
            fixture.consumer,
            fixture.contractId,
            ct03OwnershipBody()
          )
        );
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const edge = await client.getDownstream(fixture.consumer);
        expect(edge.peer).toBe(fixture.consumer);
        expect(edge.contracts[0].id).toBe(fixture.contractId);
      });
  });
});
