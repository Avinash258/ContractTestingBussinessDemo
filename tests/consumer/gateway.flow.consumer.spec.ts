import {
  CONTRACTS,
  uniqueFlowPairs,
  type ContractDef,
} from '../../src/catalog/contracts';
import { createGatewayPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { gatewayFlowPairBody } from '../../src/matchers/common';
import { MatchersV3 } from '@pact-foundation/pact';
import { gateway, testDefaults } from '../../src/testdata';

const { like, string, eachLike, integer, boolean } = MatchersV3;
const gw = gateway.health;

/**
 * Gateway Data-flow APIs from Swagger:
 *  - GET /api/flow
 *  - GET /api/flow/edges
 *  - GET /api/flow/downstream/{from}/{to}  (getFlowDownstreamPair)
 *  - GET /api/flow/upstream/{from}/{to}
 * plus gateway catalog/health + filing GET surface.
 */
describe('TaxMesh Gateway (Swagger Data flow + catalog)', () => {
  const pact = createGatewayPact();

  it('GET /api/health', async () => {
    await pact
      .addInteraction()
      .given('TaxMesh gateway and services are running')
      .uponReceiving('a client health check against the gateway')
      .withRequest('GET', '/api/health', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            gateway: string(gw.gateway),
            services: eachLike(
              like({ id: string(gw.sampleServiceId), healthy: boolean(true) }),
              1
            ),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(createJsonClient(url), '/api/health');
        expect(status).toBe(testDefaults.httpOk);
        expect(data.gateway).toBe(gw.gateway);
      });
  });

  it('GET /api/architecture', async () => {
    await pact
      .addInteraction()
      .given('TaxMesh architecture catalog is available')
      .uponReceiving('a client request for architecture')
      .withRequest('GET', '/api/architecture', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            services: eachLike(like({ id: string(gw.sampleServiceId) }), 1),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/architecture'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(Array.isArray(data.services)).toBe(true);
      });
  });

  it('GET /api/contracts', async () => {
    await pact
      .addInteraction()
      .given('TaxMesh CT catalog is available')
      .uponReceiving('a client request for contracts catalog')
      .withRequest('GET', '/api/contracts', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            contracts: eachLike(like({ id: string('CT-00') }), 1),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/contracts'
        );
        expect(status).toBe(testDefaults.httpOk);
        const list = data.contracts || data;
        expect(Array.isArray(list) || typeof data === 'object').toBe(true);
      });
  });

  it('GET /api/flow', async () => {
    await pact
      .addInteraction()
      .given('TaxMesh data-flow catalog is available')
      .uponReceiving('a client request for full flow catalog')
      .withRequest('GET', '/api/flow', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({}));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(createJsonClient(url), '/api/flow');
        expect(status).toBe(testDefaults.httpOk);
        expect(data).toBeTruthy();
      });
  });

  it('GET /api/flow/edges', async () => {
    await pact
      .addInteraction()
      .given('TaxMesh flow edges are available')
      .uponReceiving('a client request for flow edges')
      .withRequest('GET', '/api/flow/edges', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            count: integer(1),
            edges: eachLike(
              like({
                from: string(gw.sampleEdge.from),
                to: string(gw.sampleEdge.to),
              }),
              1
            ),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/flow/edges'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.count).toBeGreaterThan(0);
      });
  });

  const downstreamPairs = uniqueFlowPairs('downstream');
  it.each(downstreamPairs.map((p) => [`${p.from}->${p.to}`, p] as const))(
    'GET /api/flow/downstream/%s',
    async (_label, pair) => {
      const ct = CONTRACTS.find(
        (c) =>
          c.producer === pair.from &&
          c.consumer === pair.to &&
          c.direction === 'downstream'
      ) as ContractDef;

      await createGatewayPact()
        .addInteraction()
        .given(`downstream edge ${pair.from} to ${pair.to} exists`)
        .uponReceiving(
          `a client request for getFlowDownstreamPair ${pair.from}/${pair.to}`
        )
        .withRequest(
          'GET',
          `/api/flow/downstream/${pair.from}/${pair.to}`,
          (b) => {
            b.headers({ Accept: 'application/json' });
          }
        )
        .willRespondWith(testDefaults.httpOk, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(
            gatewayFlowPairBody(
              pair.from,
              pair.to,
              testDefaults.flowDownstream as 'downstream',
              ct.id
            )
          );
        })
        .executeTest(async ({ url }) => {
          const { status, data } = await getJson(
            createJsonClient(url),
            `/api/flow/downstream/${pair.from}/${pair.to}`
          );
          expect(status).toBe(testDefaults.httpOk);
          expect(data.from).toBe(pair.from);
          expect(data.to).toBe(pair.to);
          expect(data.flow).toBe(testDefaults.flowDownstream);
          expect(data.contracts[0].id).toBe(ct.id);
        });
    }
  );

  const upstreamPairs = uniqueFlowPairs('reverse');
  it.each(upstreamPairs.map((p) => [`${p.from}->${p.to}`, p] as const))(
    'GET /api/flow/upstream/%s',
    async (_label, pair) => {
      const ct = CONTRACTS.find(
        (c) =>
          c.producer === pair.from &&
          c.consumer === pair.to &&
          c.direction === 'reverse'
      ) as ContractDef;

      await createGatewayPact()
        .addInteraction()
        .given(`upstream edge ${pair.from} to ${pair.to} exists`)
        .uponReceiving(
          `a client request for getFlowUpstreamPair ${pair.from}/${pair.to}`
        )
        .withRequest(
          'GET',
          `/api/flow/upstream/${pair.from}/${pair.to}`,
          (b) => {
            b.headers({ Accept: 'application/json' });
          }
        )
        .willRespondWith(testDefaults.httpOk, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(
            gatewayFlowPairBody(
              pair.from,
              pair.to,
              testDefaults.flowUpstream as 'upstream',
              ct.id
            )
          );
        })
        .executeTest(async ({ url }) => {
          const { status, data } = await getJson(
            createJsonClient(url),
            `/api/flow/upstream/${pair.from}/${pair.to}`
          );
          expect(status).toBe(testDefaults.httpOk);
          expect(data.from).toBe(pair.from);
          expect(data.to).toBe(pair.to);
          expect(data.flow).toBe(testDefaults.flowUpstream);
          expect(data.contracts[0].id).toBe(ct.id);
        });
    }
  );

  // Filing GET surface (Swagger Filing — Form 1065)
  it.each(gateway.filingGets.paths as string[])('GET %s', async (path) => {
    await createGatewayPact()
      .addInteraction()
      .given(`filing endpoint ${path} is available`)
      .uponReceiving(`a client GET ${path}`)
      .withRequest('GET', path, (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({}));
      })
      .executeTest(async ({ url }) => {
        const { status } = await getJson(createJsonClient(url), path);
        expect(status).toBe(testDefaults.httpOk);
      });
  });
});
