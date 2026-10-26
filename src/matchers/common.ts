import { MatchersV3 } from '@pact-foundation/pact';

const { string, like, eachLike, regex, boolean, integer } = MatchersV3;

export const isoTimestamp = (example = '2025-10-26T10:00:00.000Z') =>
  regex(/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/, example);

/** Recursively wrap plain JSON into Pact `like` matchers (null stays nullValue). */
export function deepLike(value: unknown): unknown {
  if (value === null) return MatchersV3.nullValue();
  if (Array.isArray(value)) {
    if (value.length === 0) return like([]);
    return eachLike(deepLike(value[0]), 1);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepLike(v);
    }
    return like(out);
  }
  if (typeof value === 'string') return string(value);
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? MatchersV3.integer(value)
      : MatchersV3.number(value);
  }
  if (typeof value === 'boolean') return boolean(value);
  return like(value as never);
}

export function producerEnvelope(
  producer: string,
  consumer: string,
  direction: 'downstream' | 'reverse'
) {
  return {
    producer: string(producer),
    consumer: string(consumer),
    direction: string(direction),
    flow: string(direction === 'reverse' ? 'upstream' : 'downstream'),
    producedAt: isoTimestamp(),
  };
}

export function healthBody(serviceKey: string, producedExample: string) {
  return like({
    status: string('ok'),
    service: string(serviceKey),
    produced: eachLike(string(producedExample), 1),
  });
}

export function contractsCatalogBody(serviceId: string, producedId: string) {
  return like({
    service: like({ id: string(serviceId) }),
    produced: eachLike(
      like({
        id: string(producedId),
        producer: string(serviceId),
      }),
      1
    ),
  });
}

export function peerFlowBody(
  service: string,
  peer: string,
  flow: 'downstream' | 'upstream',
  contractId: string,
  payloadBody: unknown
) {
  return like({
    service: string(service),
    peer: string(peer),
    flow: string(flow),
    contracts: eachLike(
      like({
        id: string(contractId),
        producer: string(service),
        consumer: string(peer),
      }),
      1
    ),
    payloads: eachLike(payloadBody, 1),
  });
}

export function gatewayFlowPairBody(
  from: string,
  to: string,
  flow: 'downstream' | 'upstream',
  contractId: string
) {
  return like({
    from: string(from),
    to: string(to),
    flow: string(flow),
    contracts: eachLike(
      like({
        id: string(contractId),
        producer: string(from),
        consumer: string(to),
      }),
      1
    ),
    payloads: eachLike(
      like({
        contractId: string(contractId),
        title: string('title'),
        sample: like({ contractId: string(contractId) }),
        live: like({
          ok: boolean(true),
          httpStatus: integer(200),
        }),
      }),
      1
    ),
  });
}
