import { z } from 'zod';

/**
 * Zod schema for CT-00 (CLM → MDM) engagement context.
 * Matches TaxMesh `shared/payloads.js` + producer envelope from `createService`.
 */
export const ct00EngagementSchema = z
  .object({
    contractId: z.literal('CT-00'),
    engagementId: z.string().min(1),
    clientId: z.string().min(1),
    projectId: z.string().min(1),
    entityGroupId: z.string().min(1),
    jobId: z.string().min(1),
    taxYear: z.number().int().positive(),
    formType: z.string().min(1),
    dueDate: z.string().min(1),
    producer: z.literal('CLM'),
    consumer: z.literal('MDM'),
    direction: z.enum(['downstream', 'reverse']),
    flow: z.enum(['downstream', 'upstream']),
    producedAt: z.string().min(1),
  })
  .passthrough();

export type Ct00Engagement = z.infer<typeof ct00EngagementSchema>;

export const clmHealthSchema = z
  .object({
    status: z.string(),
    service: z.string(),
    produced: z.array(z.string()).optional(),
    consumed: z.array(z.string()).optional(),
  })
  .passthrough();

export const clmContractsCatalogSchema = z
  .object({
    service: z.object({ id: z.string() }).passthrough(),
    produced: z.array(
      z
        .object({
          id: z.string(),
          producer: z.string(),
          consumer: z.string(),
        })
        .passthrough()
    ),
    consumed: z.array(z.unknown()),
  })
  .passthrough();

export function assertSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Schema validation failed for ${label}: ${details}`);
  }
  return result.data;
}
