import emptyPeer from '../../testdata/common/empty-peer.json';
import { createServicePairPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { deepLike } from '../../src/matchers/common';
import type { ServiceId } from '../../src/catalog/contracts';

/**
 * Swagger ops that have no CT peer in catalog still exist on OpenAPI
 * (`/api/proxy/{SVC}/upstream|downstream/{peerId}`). Live TaxMesh returns 404
 * with an error envelope — contract that shape so coverage is complete vs api-docs.
 *
 * Paths are string literals (also listed in testdata) so swagger coverage static
 * scan / catalog extras can see them without relying on generated pacts.
 */
describe('Empty peer surfaces (Swagger alignment — 404)', () => {
  it.each(emptyPeer.cases)(
    '$service $flow/$peer → $status',
    async (c) => {
      const producer = c.service as ServiceId;
      const peer = c.peer as ServiceId;
      // Keep concrete path for Pact + coverage; must match testdata cases.
      const path = `/${c.flow}/${c.peer}` as '/upstream/MDM' | '/downstream/MDM' | '/upstream/ACC';
      const pact = createServicePairPact(peer, producer);

      await pact
        .addInteraction()
        .given(c.state)
        .uponReceiving(
          `a ${peer} request for empty ${producer} ${c.flow} peer ${c.peer}`
        )
        .withRequest('GET', path, (b) => {
          b.headers({ Accept: 'application/json' });
        })
        .willRespondWith(c.status, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(deepLike(c.body));
        })
        .executeTest(async ({ url }) => {
          const { status, data } = await getJson(createJsonClient(url), path);
          expect(status).toBe(c.status);
          expect(data.service).toBe(c.body.service);
          expect(data.peer).toBe(c.body.peer);
          expect(data.flow).toBe(c.body.flow);
          expect(data.error).toBeTruthy();
        });
    }
  );
});
