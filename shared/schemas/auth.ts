import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
}).strict()

export const adminUserDtoSchema = z.object({
  id: resourceIdSchema,
  username: z.string().min(1).max(100),
  version: resourceVersionSchema,
}).strict()

export const adminSessionDtoSchema = z.object({
  user: adminUserDtoSchema,
  csrfToken: z.string().min(32).max(128),
}).strict()

export const loginResponseSchema = apiSuccessSchema(adminSessionDtoSchema)
export const sessionResponseSchema = apiSuccessSchema(adminSessionDtoSchema)

export const changePasswordRequestSchema = versionedRequestSchema(
  z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  }).strict(),
)

export const changePasswordResponseSchema = apiSuccessSchema(z.object({
  version: resourceVersionSchema,
  reauthenticationRequired: z.literal(true),
}).strict())

export const logoutResponseSchema = apiSuccessSchema(z.object({
  cleared: z.literal(true),
}).strict())
