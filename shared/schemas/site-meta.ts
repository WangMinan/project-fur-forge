import { z } from 'zod'
import { apiSuccessSchema } from './api'

export const policeFilingStatusSchema = z.enum([
  'unconfigured',
  'not_applicable',
  'filed',
])

export const publicFilingItemSchema = z.object({
  number: z.string().trim().min(1).max(120),
  url: z.string().url().max(2_048),
}).strict()

export const publicSiteMetaSchema = z.object({
  filings: z.object({
    icp: publicFilingItemSchema.nullable(),
    police: publicFilingItemSchema.nullable(),
  }).strict(),
}).strict()

export const publicSiteMetaResponseSchema = apiSuccessSchema(
  publicSiteMetaSchema,
)
