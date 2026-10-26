import { CONTRACTS } from '../../src/catalog/contracts';
import { createGatewayPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { MatchersV3 } from '@pact-foundation/pact';

const { like, string } = MatchersV3;

/**
 * Swagger gap: GET /api/contracts/{id}
 * Completes gateway catalog coverage for CT-00…CT-17.
 */
describe('Gateway GET /api/contracts/{id} (Swagger gap)', () => {
  it.each(CONTRACTS.map((c) => [c.id, c] as const))(
    'GET /api/contracts/%s',
    async (_id, ct) => {
      await createGatewayPact()
        .addInteraction()
        .given(`contract ${ct.id} exists in catalog`)
        .uponReceiving(`a client request for contract detail ${ct.id}`)
        .withRequest('GET', `/api/contracts/${ct.id}`, (b) => {
          b.headers({ Accept: 'application/json' });
        })
        .willRespondWith(200, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(
            like({
              id: string(ct.id),
              producer: string(ct.producer),
              consumer: string(ct.consumer),
              path: string(ct.path),
              title: string(ct.title),
              samplePayload: like({ contractId: string(ct.id) }),
            })
          );
        })
        .executeTest(async ({ url }) => {
          const { status, data } = await getJson(
            createJsonClient(url),
            `/api/contracts/${ct.id}`
          );
          expect(status).toBe(200);
          expect(data.id).toBe(ct.id);
          expect(data.producer).toBe(ct.producer);
          expect(data.consumer).toBe(ct.consumer);
          expect(data.samplePayload.contractId).toBe(ct.id);
        });
    }
  );
});
