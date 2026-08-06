import type { H3Event } from 'h3'
import type { ZodType } from 'zod'
import { adminSiteContentResponseSchema } from '../../../shared/schemas/site-content'
import { createApiError } from '../api-error'
import { adminSessionFor } from './auth-session'
import { getDatabase } from '../database'
import { readAdminJsonBody } from './request-body'
import { updateSiteContentSection } from '../service/site-content'
import type { SiteContentSection } from '../service/site-content'
import { asSafeApiError } from '../service-error'

/**
 * T34-F3 分区写入入口：所有分区共用同一套管理 Host、认证、Origin、CSRF、
 * no-store 与 Schema 校验，只在赋值列和版本列上不同。
 */
export function defineSiteContentSectionHandler<T>(options: {
  requestSchema: ZodType<{ expectedVersion: number, payload: T }>
  section: SiteContentSection
  toValues: (payload: T) => Record<string, string | null>
}) {
  return async (event: H3Event) => {
    const body = options.requestSchema.safeParse(
      await readAdminJsonBody(event),
    )
    if (!body.success) {
      throw createApiError(400, 'VALIDATION_ERROR', 'Site content section is invalid.')
    }
    try {
      return adminSiteContentResponseSchema.parse({
        data: updateSiteContentSection(
          getDatabase().sqlite,
          options.section,
          body.data.expectedVersion,
          options.toValues(body.data.payload),
          adminSessionFor(event).user.id,
        ),
      })
    }
    catch (error) {
      asSafeApiError(error)
    }
  }
}
