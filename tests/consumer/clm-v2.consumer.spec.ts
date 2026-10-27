import fs from 'fs';
import path from 'path';
import { createGatewayPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import { deepLike } from '../../src/matchers/common';
import { testDefaults } from '../../src/testdata';
import axios from 'axios';
import { httpAgent, httpsAgent } from '../../src/clients/httpAgent';

const loadFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, `../../testdata/clm/${name}.json`),
      'utf8'
    )
  );

/**
 * Gateway proxy CLM v2 APIs — PactV4 against TaxMesh-Gateway.
 * Example bodies from testdata/clm/v2-*.json (aligned to live TaxMesh).
 */
describe('CLM v2 API contracts (via Gateway proxy)', () => {
  it('GET /api/proxy/CLM/v2/status', async () => {
    const fixture = loadFixture('v2-status-pos');
    await createGatewayPact()
      .addInteraction()
      .given('CLM v2 status is healthy')
      .uponReceiving('a client request for CLM v2 status')
      .withRequest('GET', '/api/proxy/CLM/v2/status', (b) => {
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          '/api/proxy/CLM/v2/status'
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.apiVersion).toBe(fixture.apiVersion);
      });
  });

  it('GET /api/proxy/CLM/v2/engagement', async () => {
    const fixture = loadFixture('v2-engagement-pos');
    const pathWithQuery = '/api/proxy/CLM/v2/engagement';
    await createGatewayPact()
      .addInteraction()
      .given('CLM has engagement ENG-200')
      .uponReceiving('a client request for CLM v2 engagement')
      .withRequest('GET', pathWithQuery, (b) => {
        b.query({ id: 'ENG-200' });
        b.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await getJson(
          createJsonClient(url),
          `${pathWithQuery}?id=ENG-200`
        );
        expect(status).toBe(testDefaults.httpOk);
        expect(data.service).toBe(fixture.service);
        expect(data.engagement).toBeTruthy();
        expect(data.engagement.engagementId).toBeTruthy();
      });
  });

  it('PATCH /api/proxy/CLM/v2/engagement without allowed fields → 400', async () => {
    const fixture = loadFixture('v2-engagement-patch');
    const pathWithQuery = '/api/proxy/CLM/v2/engagement';
    await createGatewayPact()
      .addInteraction()
      .given('CLM has engagement ENG-200')
      .uponReceiving('a client PATCH CLM v2 engagement with invalid body')
      .withRequest('PATCH', pathWithQuery, (b) => {
        b.query({ id: 'ENG-200' });
        b.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        b.jsonBody({ status: 'Completed' });
      })
      .willRespondWith(testDefaults.httpBadRequest, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(deepLike(fixture));
      })
      .executeTest(async ({ url }) => {
        const res = await axios.patch(
          `${url}${pathWithQuery}?id=ENG-200`,
          { status: 'Completed' },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Connection: 'close',
            },
            httpAgent,
            httpsAgent,
            validateStatus: () => true,
            timeout: 15_000,
          }
        );
        expect(res.status).toBe(testDefaults.httpBadRequest);
        expect(res.data.apiVersion).toBe(fixture.apiVersion);
        expect(res.data.error).toBeTruthy();
      });
  });
});
