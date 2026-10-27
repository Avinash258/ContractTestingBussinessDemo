import fs from 'fs';
import path from 'path';
import { createGatewayPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { deepLike } from '../../src/matchers/common';
import { testDefaults } from '../../src/testdata';

const loadFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../../testdata/mdm/${name}.json`),
      'utf8'
    )
  );

/**
 * Gateway proxy MDM v2 APIs — PactV4 against TaxMesh-Gateway.
 * Example bodies from testdata/mdm/v2-*.json (aligned to live TaxMesh).
 * Negative id/query contracts omitted: live demo returns 200 for unknown ids.
 */
describe('MDM v2 API contracts (via Gateway proxy)', () => {
  it('GET /api/proxy/MDM/v2/status', async () => {
    const fixture = loadFixture('v2-status-pos');
    await createGatewayPact()
      .addInteraction()
      .given('MDM has v2 status active')
      .uponReceiving('a client request for MDM v2 status')
      .withRequest('GET', '/api/proxy/MDM/v2/status', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/proxy/MDM/v2/status'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.apiVersion).toBe(fixture.apiVersion);
      });
  });

  it('GET /api/proxy/MDM/v2/entity', async () => {
    const fixture = loadFixture('v2-entity-pos');
    await createGatewayPact()
      .addInteraction()
      .given('MDM has entity E-100')
      .uponReceiving('a client request for MDM v2 entity')
      .withRequest('GET', '/api/proxy/MDM/v2/entity', (b) => {
        b.query({ id: 'E-100' });
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/proxy/MDM/v2/entity?id=E-100'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.entity?.entityId).toBeTruthy();
      });
  });

  it('GET /api/proxy/MDM/v2/ownership', async () => {
    const fixture = loadFixture('v2-ownership-pos');
    await createGatewayPact()
      .addInteraction()
      .given('MDM has ownership for E-100')
      .uponReceiving('a client request for MDM v2 ownership')
      .withRequest('GET', '/api/proxy/MDM/v2/ownership', (b) => {
        b.query({ id: 'E-100' });
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/proxy/MDM/v2/ownership?id=E-100'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.byPartner?.length).toBeGreaterThan(0);
      });
  });

  it('GET /api/proxy/MDM/v2/partners', async () => {
    const fixture = loadFixture('v2-partners-pos');
    await createGatewayPact()
      .addInteraction()
      .given('MDM has partners list')
      .uponReceiving('a client request for MDM v2 partners')
      .withRequest('GET', '/api/proxy/MDM/v2/partners', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/proxy/MDM/v2/partners'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.partners?.length).toBeGreaterThan(0);
      });
  });
});
