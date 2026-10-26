import { MatchersV3 } from '@pact-foundation/pact';
import type { ContractDef } from '../catalog/contracts';
import { PAYLOADS } from '../catalog/payloads';
import { deepLike, producerEnvelope } from './common';

const { like, string } = MatchersV3;

function payloadFields(ct: ContractDef): Record<string, unknown> {
  const base = PAYLOADS[ct.id];
  if (!base) throw new Error(`No payload fixture for ${ct.id}`);
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, deepLike(v)])
  );
}

/** Pact body for a producer CT payload (+ envelope fields services add). */
export function contractPayloadBody(ct: ContractDef) {
  return like({
    ...payloadFields(ct),
    contractId: string(ct.id),
    ...producerEnvelope(ct.producer, ct.consumer, ct.direction),
  });
}

/** Peer flow payload includes title + path from produceEnvelope. */
export function peerPayloadBody(ct: ContractDef) {
  return like({
    ...payloadFields(ct),
    contractId: string(ct.id),
    title: string(ct.title),
    path: string(ct.path),
    ...producerEnvelope(ct.producer, ct.consumer, ct.direction),
  });
}
