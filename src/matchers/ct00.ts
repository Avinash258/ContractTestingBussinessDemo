import { MatchersV3 } from '@pact-foundation/pact';
import {
  clmContractsCatalogFixture,
  clmDownstreamMdmFixture,
  clmHealthFixture,
  engagementFixture,
} from '../fixtures/engagement';

const { string, integer, like, eachLike, regex } = MatchersV3;

/** Flexible ISO-ish timestamp from CLM producer envelope (full-string match) */
const isoTimestamp = (example: string) =>
  regex(/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/, example);

/** Pact body matcher for CT-00 engagement context (CLM → MDM). */
export function ct00EngagementBody() {
  return like({
    contractId: string(engagementFixture.contractId),
    engagementId: string(engagementFixture.engagementId),
    clientId: string(engagementFixture.clientId),
    projectId: string(engagementFixture.projectId),
    entityGroupId: string(engagementFixture.entityGroupId),
    jobId: string(engagementFixture.jobId),
    taxYear: integer(engagementFixture.taxYear),
    formType: string(engagementFixture.formType),
    dueDate: string(engagementFixture.dueDate),
    producer: string(engagementFixture.producer),
    consumer: string(engagementFixture.consumer),
    direction: string(engagementFixture.direction),
    flow: string(engagementFixture.flow),
    producedAt: isoTimestamp(engagementFixture.producedAt),
  });
}

export function clmHealthBody() {
  return like({
    status: string(clmHealthFixture.status),
    service: string(clmHealthFixture.service),
    produced: eachLike(string(clmHealthFixture.produced[0]), 1),
    consumed: like(clmHealthFixture.consumed),
  });
}

export function clmContractsCatalogBody() {
  const svc = clmContractsCatalogFixture.service;
  const produced = clmContractsCatalogFixture.produced[0];
  return like({
    service: like({
      id: string(svc.id),
      name: string(svc.name),
      port: integer(svc.port),
    }),
    produced: eachLike(
      like({
        id: string(produced.id),
        producer: string(produced.producer),
        consumer: string(produced.consumer),
        direction: string(produced.direction),
        path: string(produced.path),
      }),
      1
    ),
    consumed: like(clmContractsCatalogFixture.consumed),
  });
}

export function clmDownstreamMdmBody() {
  const edge = clmDownstreamMdmFixture;
  const c = edge.contracts[0];
  return like({
    service: string(edge.service),
    peer: string(edge.peer),
    flow: string(edge.flow),
    contracts: eachLike(
      like({
        id: string(c.id),
        producer: string(c.producer),
        consumer: string(c.consumer),
      }),
      1
    ),
    payloads: eachLike(ct00EngagementBody(), 1),
  });
}
