import {
  CONTRACTS,
  apiFlow,
  type ContractDef,
} from '../../src/catalog/contracts';
import { createServicePairPact } from '../../src/pact/pactFactory';
import { createJsonClient, getJson } from '../../src/clients/httpJson';
import {
  contractPayloadBody,
  peerPayloadBody,
} from '../../src/matchers/payloadBody';
import { peerFlowBody } from '../../src/matchers/common';

/**
 * Completes CT-05…CT-17 producer contracts + peer flow edges.
 * CT-00…CT-04 remain in dedicated CLM/MDM consumer specs.
 */
const remaining = CONTRACTS.filter((c) => {
  const n = Number(c.id.replace('CT-', ''));
  return n >= 5;
});

describe('TaxMesh contracts CT-05…CT-17', () => {
  it.each(remaining.map((c) => [c.id, c] as const))(
    '%s produce path',
    async (_id, ct: ContractDef) => {
      const pact = createServicePairPact(ct.consumer, ct.producer);
      await pact
        .addInteraction()
        .given(`${ct.producer} produces ${ct.id} for ${ct.consumer}`)
        .uponReceiving(`a ${ct.consumer} request for ${ct.id} ${ct.title}`)
        .withRequest('GET', ct.path, (builder) => {
          builder.headers({ Accept: 'application/json' });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody(contractPayloadBody(ct));
        })
        .executeTest(async (mockServer) => {
          const client = createJsonClient(mockServer.url);
          const { status, data } = await getJson(client, ct.path);
          expect(status).toBe(200);
          expect(data.contractId).toBe(ct.id);
          expect(data.producer).toBe(ct.producer);
          expect(data.consumer).toBe(ct.consumer);
        });
    }
  );

  it.each(remaining.map((c) => [c.id, c] as const))(
    '%s peer flow path',
    async (_id, ct: ContractDef) => {
      const flow = apiFlow(ct.direction);
      const peerPath = `/${flow}/${ct.consumer}`;
      const pact = createServicePairPact(ct.consumer, ct.producer);

      await pact
        .addInteraction()
        .given(`${ct.producer} has ${flow} contracts to ${ct.consumer}`)
        .uponReceiving(
          `a ${ct.consumer} request for ${ct.producer} ${flow} payloads to ${ct.consumer} (${ct.id})`
        )
        .withRequest('GET', peerPath, (builder) => {
          builder.headers({ Accept: 'application/json' });
        })
        .willRespondWith(200, (builder) => {
          builder.headers({ 'Content-Type': 'application/json' });
          builder.jsonBody(
            peerFlowBody(
              ct.producer,
              ct.consumer,
              flow,
              ct.id,
              peerPayloadBody(ct)
            )
          );
        })
        .executeTest(async (mockServer) => {
          const client = createJsonClient(mockServer.url);
          const { status, data } = await getJson(client, peerPath);
          expect(status).toBe(200);
          expect(data.service).toBe(ct.producer);
          expect(data.peer).toBe(ct.consumer);
          expect(data.flow).toBe(flow);
          expect(data.contracts[0].id).toBe(ct.id);
        });
    }
  );
});
