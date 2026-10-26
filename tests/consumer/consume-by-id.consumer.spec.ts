import {
  CONTRACTS,
  SERVICES,
  apiFlow,
  type ContractDef,
} from '../../src/catalog/contracts';
import { createPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { MatchersV3 } from '@pact-foundation/pact';

const { like, string, boolean } = MatchersV3;

/**
 * Swagger gap: GET /api/proxy/{svc}/consume/{contractId}
 * Pact path on the consumer service: GET /consume/{contractId}
 *
 * Provider = consuming service (pulls from producer).
 * Consumer = TaxMesh-Client (orchestrator / gateway client).
 */
describe('Service GET /consume/{contractId} (Swagger gap)', () => {
  it.each(CONTRACTS.map((c) => [c.id, c.consumer, c.producer, c] as const))(
    '%s consumed by %s from %s',
    async (_id, _consumer, _producer, ct: ContractDef) => {
      const provider = SERVICES[ct.consumer].pactProvider;
      const pact = createPact('TaxMesh-Client', provider);
      const path = `/consume/${ct.id}`;

      await pact
        .addInteraction()
        .given(`${ct.consumer} can consume ${ct.id} from ${ct.producer}`)
        .uponReceiving(
          `a client request for ${ct.consumer} to consume ${ct.id}`
        )
        .withRequest('GET', path, (b) => {
          b.headers({ Accept: 'application/json' });
        })
        .willRespondWith(200, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(
            like({
              contractId: string(ct.id),
              consumer: string(ct.consumer),
              producer: string(ct.producer),
              direction: string(ct.direction),
              flow: string(apiFlow(ct.direction)),
              ok: boolean(true),
              payload: like({ contractId: string(ct.id) }),
            })
          );
        })
        .executeTest(async ({ url }) => {
          const { status, data } = await getJson(createJsonClient(url), path);
          expect(status).toBe(200);
          expect(data.contractId).toBe(ct.id);
          expect(data.consumer).toBe(ct.consumer);
          expect(data.producer).toBe(ct.producer);
          expect(data.ok).toBe(true);
          expect(data.payload.contractId).toBe(ct.id);
        });
    }
  );
});
