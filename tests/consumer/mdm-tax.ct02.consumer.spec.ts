import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct02TaxAttributesBody,
  mdmDownstreamPeerBody,
} from '../../src/matchers/mdm';

describe('TAX ← MDM contracts (CT-02)', () => {
  const ct = config.mdm.contracts.ct02;
  const pact = createMdmPact(ct.consumer);

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
        expect(body.contractId).toBe('CT-02');
        expect(body.producer).toBe('MDM');
        expect(body.consumer).toBe('TAX');
        expect(body.taxAttributes.filingType).toBe('1065');
        expect(body.taxAttributes.states.length).toBeGreaterThan(0);
      });
  });

  it('GET /downstream/TAX — MDM publishes CT-02 on MDM→TAX edge', async () => {
    await pact
      .addInteraction()
      .given('MDM has downstream contracts to TAX')
      .uponReceiving('a TAX request for MDM downstream payloads to TAX')
      .withRequest('GET', '/downstream/TAX', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody('TAX', 'CT-02', ct02TaxAttributesBody())
        );
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const edge = await client.getDownstream('TAX');
        expect(edge.peer).toBe('TAX');
        expect(edge.contracts[0].id).toBe('CT-02');
      });
  });
});
