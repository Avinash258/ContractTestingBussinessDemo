import { MatchersV3 } from '@pact-foundation/pact';
import { engagementFixture, clmHealthFixture } from '../fixtures/engagement';

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
    produced: eachLike(string('CT-00'), 1),
    consumed: like([]),
  });
}

export function clmContractsCatalogBody() {
  return like({
    service: like({
      id: string('CLM'),
      name: string('Client Management'),
      port: integer(4101),
    }),
    produced: eachLike(
      like({
        id: string('CT-00'),
        producer: string('CLM'),
        consumer: string('MDM'),
        direction: string('downstream'),
        path: string('/contracts/ct-00/engagement-context'),
      }),
      1
    ),
    consumed: like([]),
  });
}
