import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct02TaxAttributesBody,
  mdmDownstreamPeerBody,
} from '../../src/matchers/mdm';
import { ct02TaxAttributesFixture } from '../../src/fixtures/mdm';

describe('TAX ← MDM contracts (CT-02)', () => {
  const ct = config.mdm.contracts.ct02;
  const pact = createMdmPact(ct.consumer);
  const fixture = ct02TaxAttributesFixture;

  it('GET /contracts/ct-02/tax-attributes — entity tax attributes', async () => {
    await pact
      .addInteraction()
      .given('MDM has tax attributes for TAX')
      .uponReceiving('a TAX request for CT-02 tax attributes')
      .withRequest('GET', ct.path, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(ct02TaxAttributesBody());
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const body = await client.getTaxAttributes();
        expect(body.contractId).toBe(fixture.contractId);
        expect(body.producer).toBe(fixture.producer);
        expect(body.consumer).toBe(fixture.consumer);
        expect(body.taxAttributes.filingType).toBe(
          fixture.taxAttributes.filingType
        );
        expect(body.taxAttributes.states.length).toBeGreaterThan(0);
      });
  });

  it('GET /downstream/TAX — MDM publishes CT-02 on MDM→TAX edge', async () => {
    await pact
      .addInteraction()
      .given('MDM has downstream contracts to TAX')
      .uponReceiving('a TAX request for MDM downstream payloads to TAX')
      .withRequest('GET', `/downstream/${fixture.consumer}`, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody(
            fixture.consumer,
            fixture.contractId,
            ct02TaxAttributesBody()
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
