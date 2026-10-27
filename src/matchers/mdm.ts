import { MatchersV3 } from '@pact-foundation/pact';
import {
  ct01EntitiesFixture,
  ct02TaxAttributesFixture,
  ct03OwnershipFixture,
  ct04FilingMetaFixture,
  mdmHealthFixture,
} from '../fixtures/mdm';
import { testEnvelope } from '../testdata';

const { string, integer, boolean, number, like, eachLike, regex, nullValue } =
  MatchersV3;

const isoTimestamp = (example: string) =>
  regex(/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/, example);

const producerEnvelope = (consumer: string) => ({
  producer: string(testEnvelope.producer),
  consumer: string(consumer),
  direction: string(testEnvelope.direction),
  flow: string(testEnvelope.flow),
  producedAt: isoTimestamp(testEnvelope.producedAt),
});

export function mdmHealthBody() {
  return like({
    status: string(mdmHealthFixture.status),
    service: string(mdmHealthFixture.service),
    produced: eachLike(string(mdmHealthFixture.produced[0]), 1),
    consumed: eachLike(string(mdmHealthFixture.consumed[0]), 1),
  });
}

export function ct01EntitiesBody() {
  const e = ct01EntitiesFixture.entities[0];
  return like({
    contractId: string(ct01EntitiesFixture.contractId),
    engagementId: string(ct01EntitiesFixture.engagementId),
    entities: eachLike(
      like({
        entityId: string(e.entityId),
        legalName: string(e.legalName),
        ein: string(e.ein),
        entityType: string(e.entityType),
        taxYear: integer(e.taxYear),
      }),
      1
    ),
    ...producerEnvelope(ct01EntitiesFixture.consumer),
  });
}

export function ct02TaxAttributesBody() {
  const t = ct02TaxAttributesFixture.taxAttributes;
  return like({
    contractId: string(ct02TaxAttributesFixture.contractId),
    engagementId: string(ct02TaxAttributesFixture.engagementId),
    entityId: string(ct02TaxAttributesFixture.entityId),
    taxAttributes: like({
      filingType: string(t.filingType),
      fiscalYearEnd: string(t.fiscalYearEnd),
      multiState: boolean(t.multiState),
      states: eachLike(string(t.states[0]), 1),
      section754Election: boolean(t.section754Election),
    }),
    ...producerEnvelope(ct02TaxAttributesFixture.consumer),
  });
}

export function ct03OwnershipBody() {
  const p = ct03OwnershipFixture.partners[0];
  return like({
    contractId: string(ct03OwnershipFixture.contractId),
    engagementId: string(ct03OwnershipFixture.engagementId),
    entityId: string(ct03OwnershipFixture.entityId),
    partners: eachLike(
      like({
        partnerId: string(p.partnerId),
        name: string(p.name),
        ownershipPct: number(p.ownershipPct),
        capitalAccount: string(p.capitalAccount),
      }),
      1
    ),
    ...producerEnvelope(ct03OwnershipFixture.consumer),
  });
}

export function ct04FilingMetaBody() {
  const f = ct04FilingMetaFixture.filingMeta;
  return like({
    contractId: string(ct04FilingMetaFixture.contractId),
    engagementId: string(ct04FilingMetaFixture.engagementId),
    entityId: string(ct04FilingMetaFixture.entityId),
    filingMeta: like({
      formSet: eachLike(string(f.formSet[0]), 1),
      jurisdiction: string(f.jurisdiction),
      printPackageId: nullValue(),
      dueDate: string(f.dueDate),
    }),
    ...producerEnvelope(ct04FilingMetaFixture.consumer),
  });
}

export function mdmDownstreamPeerBody(
  peer: string,
  contractId: string,
  payloadBody: unknown
) {
  return like({
    service: string(testEnvelope.producer),
    peer: string(peer),
    flow: string(testEnvelope.flow),
    contracts: eachLike(
      like({
        id: string(contractId),
        producer: string(testEnvelope.producer),
        consumer: string(peer),
      }),
      1
    ),
    payloads: eachLike(payloadBody, 1),
  });
}
