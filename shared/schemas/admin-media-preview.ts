import { z } from 'zod'
import { apiSuccessSchema } from './api'

export const adminMediaSignedUrlSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
}).strict()

export const adminMediaSignedUrlResponseSchema = apiSuccessSchema(adminMediaSignedUrlSchema)
export type AdminMediaSignedUrl = z.infer<typeof adminMediaSignedUrlSchema>
