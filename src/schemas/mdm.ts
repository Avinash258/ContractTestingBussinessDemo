import { z } from 'zod';

const producerEnvelope = {
  producer: z.literal('MDM'),
  direction: z.enum(['downstream', 'reverse']),
  flow: z.enum(['downstream', 'upstream']),
  producedAt: z.string().min(1),
};

export const mdmHealthSchema = z
  .object({
    status: z.string(),
    service: z.string(),
    produced: z.array(z.string()).optional(),
    consumed: z.array(z.string()).optional(),
  })
  .passthrough();

export const ct01EntitiesSchema = z
  .object({
    contractId: z.literal('CT-01'),
    engagementId: z.string().min(1),
    entities: z
      .array(
        z.object({
          entityId: z.string().min(1),
          entityName: z.string().min(1),
          ein: z.string().min(1),
          entityType: z.string().min(1),
          taxYear: z.number().int().positive(),
        })
      )
      .min(1),
    consumer: z.literal('ACC'),
    ...producerEnvelope,
  })
  .passthrough();

export const ct02TaxAttributesSchema = z
  .object({
    contractId: z.literal('CT-02'),
    engagementId: z.string().min(1),
    entityId: z.string().min(1),
    taxAttributes: z.object({
      filingType: z.string().min(1),
      fiscalYearEnd: z.string().min(1),
      multiState: z.boolean(),
      states: z.array(z.string()).min(1),
      section754Election: z.boolean(),
    }),
    consumer: z.literal('TAX'),
    ...producerEnvelope,
  })
  .passthrough();

export const ct03OwnershipSchema = z
  .object({
    contractId: z.literal('CT-03'),
    engagementId: z.string().min(1),
    entityId: z.string().min(1),
    partners: z
      .array(
        z.object({
          partnerId: z.string().min(1),
          name: z.string().min(1),
          ownershipPct: z.number(),
          capitalAccount: z.string().min(1),
        })
      )
      .min(1),
    consumer: z.literal('ALC'),
    ...producerEnvelope,
  })
  .passthrough();

export const ct04FilingMetaSchema = z
  .object({
    contractId: z.literal('CT-04'),
    engagementId: z.string().min(1),
    entityId: z.string().min(1),
    filingMeta: z.object({
      formSet: z.array(z.string()).min(1),
      jurisdiction: z.string().min(1),
      printPackageId: z.string().nullable(),
      dueDate: z.string().min(1),
    }),
    consumer: z.literal('DOC'),
    ...producerEnvelope,
  })
  .passthrough();

export type Ct01Entities = z.infer<typeof ct01EntitiesSchema>;
export type Ct02TaxAttributes = z.infer<typeof ct02TaxAttributesSchema>;
export type Ct03Ownership = z.infer<typeof ct03OwnershipSchema>;
export type Ct04FilingMeta = z.infer<typeof ct04FilingMetaSchema>;

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
