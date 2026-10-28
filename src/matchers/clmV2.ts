import { MatchersV3 } from '@pact-foundation/pact';
import { clm } from '../testdata';

const { string, integer, boolean, like, eachLike } = MatchersV3;

/** Pact body for GET /v2/status — CLM readiness consumed by MDM. */
export function clmV2StatusBody() {
  const f = clm.v2Status;
  return like({
    apiVersion: integer(f.apiVersion),
    service: string(f.service),
    ready: boolean(f.ready),
    engagementId: string(f.engagementId),
    entityName: string(f.entityName),
    taxYear: integer(f.taxYear),
    correlationId: string(f.correlationId),
    feeds: eachLike(string(f.feeds[0]), 1),
  });
}

/** Pact body for GET /v2/engagement — only the fields MDM actually reads. */
export function clmV2EngagementBody() {
  const f = clm.v2Engagement;
  const e = f.engagement;
  return like({
    apiVersion: integer(f.apiVersion),
    service: string(f.service),
    ready: boolean(f.ready),
    engagement: like({
      clientId: string(e.clientId),
      engagementId: string(e.engagementId),
      projectId: string(e.projectId),
      entityGroupId: string(e.entityGroupId),
      jobId: string(e.jobId),
      entityName: string(e.entityName),
      taxYear: integer(e.taxYear),
      dueDate: string(e.dueDate),
      formType: string(e.formType),
      jurisdiction: string(e.jurisdiction),
      states: eachLike(string(e.states[0]), 1),
      correlationId: string(e.correlationId),
    }),
  });
}

/** Pact body for PATCH /v2/engagement 400 — no updatable fields in request. */
export function clmV2PatchInvalidBody() {
  const r = clm.v2EngagementPatchInvalid.response;
  return like({
    apiVersion: integer(r.apiVersion),
    error: string(r.error),
  });
}
