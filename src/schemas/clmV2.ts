import { z } from 'zod';

/**
 * Zod schemas for CLM v2 APIs (TaxMesh `shared/serviceV2Apis.js`).
 * MDM reads readiness + engagement fields before importing master data.
 */
export const clmV2StatusSchema = z
  .object({
    apiVersion: z.literal(2),
    service: z.literal('CLM'),
    ready: z.boolean(),
    engagementId: z.string().min(1).nullable(),
    entityName: z.string().nullable(),
    taxYear: z.number().int().positive().nullable(),
    correlationId: z.string().nullable(),
    feeds: z.array(z.string()),
  })
  .passthrough();

export const clmV2EngagementSchema = z
  .object({
    apiVersion: z.literal(2),
    service: z.literal('CLM'),
    ready: z.boolean(),
    engagement: z
      .object({
        clientId: z.string().min(1),
        engagementId: z.string().min(1),
        projectId: z.string().min(1),
        entityGroupId: z.string().min(1),
        jobId: z.string().min(1),
        entityName: z.string().min(1),
        taxYear: z.number().int().positive(),
        dueDate: z.string().min(1),
        formType: z.string().min(1),
        jurisdiction: z.string().min(1),
        states: z.array(z.string()),
        correlationId: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const clmV2ErrorSchema = z
  .object({
    apiVersion: z.literal(2),
    error: z.string().min(1),
  })
  .passthrough();

export type ClmV2Status = z.infer<typeof clmV2StatusSchema>;
export type ClmV2Engagement = z.infer<typeof clmV2EngagementSchema>;
export type ClmV2Error = z.infer<typeof clmV2ErrorSchema>;
