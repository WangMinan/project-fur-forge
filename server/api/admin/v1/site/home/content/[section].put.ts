import {
  adminSiteContentResponseSchema,
  siteContentSectionSchema,
  updateAboutContentRequestSchema,
  updateCommissionContentRequestSchema,
  updateContactContentRequestSchema,
  updateFaqContentRequestSchema,
  updatePrivacyContentRequestSchema,
  updateTermsContentRequestSchema,
} from '../../../../../../../shared/schemas/site-content'
import type { SiteContentSectionPayloads } from '../../../../../../utils/site-content'
import { createApiError } from '../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../utils/auth-session'
import { getDatabase } from '../../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { updateSiteContentSection } from '../../../../../../utils/site-content'
import { asSafeApiError } from '../../../../../../utils/service-error'

const requestSchemas = {
  commission: updateCommissionContentRequestSchema,
  faq: updateFaqContentRequestSchema,
  about: updateAboutContentRequestSchema,
  terms: updateTermsContentRequestSchema,
  privacy: updatePrivacyContentRequestSchema,
  contact: updateContactContentRequestSchema,
} as const

export default defineEventHandler(async (event) => {
  const section = siteContentSectionSchema.safeParse(
    getRouterParam(event, 'section'),
  )
  if (!section.success) {
    throw createApiError(404, 'NOT_FOUND', 'Site content section was not found.')
  }

  const body = requestSchemas[section.data].safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Site content is invalid.')
  }

  try {
    const payload = body.data.payload as SiteContentSectionPayloads[typeof section.data]
    return adminSiteContentResponseSchema.parse({
      data: updateSiteContentSection(
        getDatabase().sqlite,
        section.data,
        body.data.expectedVersion,
        payload,
        adminSessionFor(event).user.id,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})
