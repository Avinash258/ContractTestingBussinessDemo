import { createGatewayPact } from '../../src/pact/pactFactory';
import { MatchersV3 } from '@pact-foundation/pact';
import axios from 'axios';
import { httpAgent, httpsAgent } from '../../src/clients/httpAgent';

const { like, string } = MatchersV3;

async function postJson(baseUrl: string, path: string, body: unknown = {}) {
  const res = await axios.post(`${baseUrl.replace(/\/$/, '')}${path}`, body, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Connection: 'close',
    },
    httpAgent,
    httpsAgent,
    validateStatus: () => true,
    timeout: 60_000,
  });
  return { status: res.status, data: res.data };
}

/**
 * Swagger gap: Filing POST mutations (+ upload error contract without file).
 */
describe('Gateway filing POST mutations (Swagger gap)', () => {
  it('POST /api/filing/reset', async () => {
    await createGatewayPact()
      .addInteraction()
      .given('filing reset is available')
      .uponReceiving('a client POST filing reset')
      .withRequest('POST', '/api/filing/reset', (b) => {
        b.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        b.jsonBody(like({}));
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            formType: string('1065'),
            filingStatus: string('draft'),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await postJson(url, '/api/filing/reset');
        expect(status).toBe(200);
        expect(data.filingStatus).toBe('draft');
      });
  });

  it('POST /api/filing/run-all', async () => {
    await createGatewayPact()
      .addInteraction()
      .given('filing run-all is available')
      .uponReceiving('a client POST filing run-all')
      .withRequest('POST', '/api/filing/run-all', (b) => {
        b.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        b.jsonBody(like({}));
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(
          like({
            engagementId: string('ENG-2025-1065-001'),
            formType: string('1065'),
          })
        );
      })
      .executeTest(async ({ url }) => {
        const { status, data } = await postJson(url, '/api/filing/run-all');
        expect(status).toBe(200);
        expect(data.engagementId).toBeTruthy();
      });
  });

  it.each(['cem', 'tax'] as const)(
    'POST /api/filing/run/%s',
    async (stepId) => {
      await createGatewayPact()
        .addInteraction()
        .given(`filing run step ${stepId} is available`)
        .uponReceiving(`a client POST filing run/${stepId}`)
        .withRequest('POST', `/api/filing/run/${stepId}`, (b) => {
          b.headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
          });
          b.jsonBody(like({}));
        })
        .willRespondWith(200, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(like({ formType: string('1065') }));
        })
        .executeTest(async ({ url }) => {
          const { status } = await postJson(url, `/api/filing/run/${stepId}`);
          expect(status).toBe(200);
        });
    }
  );

  it('POST /api/filing/tax/calculate', async () => {
    await createGatewayPact()
      .addInteraction()
      .given('filing tax calculate is available')
      .uponReceiving('a client POST filing tax calculate')
      .withRequest('POST', '/api/filing/tax/calculate', (b) => {
        b.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        b.jsonBody(like({}));
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({}));
      })
      .executeTest(async ({ url }) => {
        const { status } = await postJson(url, '/api/filing/tax/calculate');
        expect(status).toBe(200);
      });
  });

  it('POST /api/filing/alc/allocate', async () => {
    await createGatewayPact()
      .addInteraction()
      .given('filing alc allocate is available')
      .uponReceiving('a client POST filing alc allocate')
      .withRequest('POST', '/api/filing/alc/allocate', (b) => {
        b.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        b.jsonBody(like({}));
      })
      .willRespondWith(200, (b) => {
        b.headers({ 'Content-Type': 'application/json' });
        b.jsonBody(like({}));
      })
      .executeTest(async ({ url }) => {
        const { status } = await postJson(url, '/api/filing/alc/allocate');
        expect(status).toBe(200);
      });
  });

  it.each(['clm', 'mdm', 'acc'] as const)(
    'POST /api/filing/upload/%s without file → 400',
    async (module) => {
      await createGatewayPact()
        .addInteraction()
        .given(`filing upload ${module} rejects missing file`)
        .uponReceiving(`a client POST filing upload/${module} without multipart file`)
        .withRequest('POST', `/api/filing/upload/${module}`, (b) => {
          b.headers({ Accept: 'application/json' });
        })
        .willRespondWith(400, (b) => {
          b.headers({ 'Content-Type': 'application/json' });
          b.jsonBody(like({}));
        })
        .executeTest(async ({ url }) => {
          const res = await axios.post(
            `${url}/api/filing/upload/${module}`,
            undefined,
            {
              headers: { Accept: 'application/json', Connection: 'close' },
              httpAgent,
              httpsAgent,
              validateStatus: () => true,
              timeout: 15_000,
            }
          );
          expect(res.status).toBe(400);
        });
    }
  );
});
