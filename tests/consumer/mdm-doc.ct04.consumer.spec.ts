import { createMdmPact } from '../../src/pact/pactFactory';
import { MdmClient } from '../../src/clients/mdmClient';
import { config } from '../../src/config';
import {
  ct04FilingMetaBody,
  mdmDownstreamPeerBody,
} from '../../src/matchers/mdm';

describe('DOC ← MDM contracts (CT-04)', () => {
  const ct = config.mdm.contracts.ct04;
  const pact = createMdmPact(ct.consumer);

  it('GET /contracts/ct-04/filing-meta — filing metadata', async () => {
    await pact
      .addInteraction()
      .given('MDM has filing metadata for DOC')
      .uponReceiving('a DOC request for CT-04 filing meta')
      .withRequest('GET', ct.path, (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(ct04FilingMetaBody());
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const body = await client.getFilingMeta();
        expect(body.contractId).toBe('CT-04');
        expect(body.producer).toBe('MDM');
        expect(body.consumer).toBe('DOC');
        expect(body.filingMeta.formSet).toContain('1065');
        expect(body.filingMeta.jurisdiction).toBeTruthy();
      });
  });

  it('GET /downstream/DOC — MDM publishes CT-04 on MDM→DOC edge', async () => {
    await pact
      .addInteraction()
      .given('MDM has downstream contracts to DOC')
      .uponReceiving('a DOC request for MDM downstream payloads to DOC')
      .withRequest('GET', '/downstream/DOC', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(
          mdmDownstreamPeerBody('DOC', 'CT-04', ct04FilingMetaBody())
        );
      })
      .executeTest(async (mockServer) => {
        const client = new MdmClient(mockServer.url);
        const edge = await client.getDownstream('DOC');
        expect(edge.peer).toBe('DOC');
        expect(edge.contracts[0].id).toBe('CT-04');
      });
  });
});
