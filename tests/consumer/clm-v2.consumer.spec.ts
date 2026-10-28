import { createClmPact } from '../../src/pact/pactFactory';
import { ClmClient } from '../../src/clients/clmClient';
import {
  clmV2EngagementBody,
  clmV2PatchInvalidBody,
  clmV2StatusBody,
} from '../../src/matchers/clmV2';
import { clm, testDefaults } from '../../src/testdata';

/**
 * MDM ← CLM v2 APIs (TaxMesh-MDM consumer → TaxMesh-CLM provider).
 * Provider verification runs against {GATEWAY}/api/proxy/CLM, so these also
 * cover Swagger ops /api/proxy/CLM/v2/status, /v2/engagement (GET + PATCH).
 */
describe('MDM ← CLM v2 API contracts', () => {
  const pact = createClmPact();

  it('GET /v2/status — CLM reports engagement readiness', async () => {
    const fixture = clm.v2Status;
    await pact
      .addInteraction()
      .given('CLM has an uploaded engagement')
      .uponReceiving('an MDM request for CLM v2 status')
      .withRequest('GET', '/v2/status', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmV2StatusBody());
      })
      .executeTest(async (mockServer) => {
        const status = await new ClmClient(mockServer.url).getV2Status();
        expect(status.service).toBe(fixture.service);
        expect(status.apiVersion).toBe(fixture.apiVersion);
        expect(status.ready).toBe(true);
        expect(status.engagementId).toBeTruthy();
        expect(status.feeds).toContain('MDM');
      });
  });

  it('GET /v2/engagement — CLM engagement snapshot for MDM import', async () => {
    const fixture = clm.v2Engagement;
    await pact
      .addInteraction()
      .given('CLM has an uploaded engagement')
      .uponReceiving('an MDM request for CLM v2 engagement')
      .withRequest('GET', '/v2/engagement', (builder) => {
        builder.headers({ Accept: 'application/json' });
      })
      .willRespondWith(testDefaults.httpOk, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmV2EngagementBody());
      })
      .executeTest(async (mockServer) => {
        const body = await new ClmClient(mockServer.url).getV2Engagement();
        expect(body.service).toBe(fixture.service);
        expect(body.ready).toBe(true);
        expect(body.engagement.engagementId).toBeTruthy();
        expect(body.engagement.entityName).toBeTruthy();
        expect(body.engagement.taxYear).toBeGreaterThan(testDefaults.minTaxYear);
        expect(body.engagement.formType).toBe(fixture.engagement.formType);
        expect(Array.isArray(body.engagement.states)).toBe(true);
      });
  });

  it('PATCH /v2/engagement without updatable fields → 400', async () => {
    const fixture = clm.v2EngagementPatchInvalid;
    await pact
      .addInteraction()
      .given('CLM has an uploaded engagement')
      .uponReceiving('an MDM PATCH of CLM v2 engagement with no allowed fields')
      .withRequest('PATCH', '/v2/engagement', (builder) => {
        builder.headers({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        });
        builder.jsonBody(fixture.request);
      })
      .willRespondWith(testDefaults.httpBadRequest, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody(clmV2PatchInvalidBody());
      })
      .executeTest(async (mockServer) => {
        const { status, data } = await new ClmClient(
          mockServer.url
        ).patchV2Engagement(fixture.request);
        expect(status).toBe(testDefaults.httpBadRequest);
        expect('error' in data && data.error).toBeTruthy();
      });
  });
});
