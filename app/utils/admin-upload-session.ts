import {
  completeUploadSessionResponseSchema,
  uploadSessionResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import type { AdminApi } from '~/composables/useAdminApi'
import { AdminApiError } from '~/composables/useAdminApi'
import {
  buildUploadDeclaration,
} from './upload-declaration'
import type {
  DeclarationFailure,
  UploadDeclaration,
} from './upload-declaration'
import { putFileToSignedUrl } from './signed-put'

export interface AdminUploadCreated {
  data: {
    session: UploadSessionDto
    upload: ConditionalPutDto
  }
}

type UploadFailure
  = | { step: 'declaration', reason: DeclarationFailure }
    | { step: 'validation', message: string }
    | { step: 'create', error: unknown }
    | { step: 'put', reason: 'expired' | 'network' | 'rejected' }
    | {
      step: 'complete'
      error: unknown
      session: UploadSessionDto | null
    }

export type AdminUploadResult
  = | {
    ok: true
    asset: VerifiedAssetDto
    session: UploadSessionDto
  }
    | ({ ok: false } & UploadFailure)

interface CompleteAdminUploadOptions {
  adminApi: AdminApi
  created: AdminUploadCreated
  file: File
  onCreated?: (created: AdminUploadCreated) => void
  onProgress: (ratio: number | null) => void
  onStage: (stage: 'uploading' | 'validating') => void
  registerXhr?: (xhr: XMLHttpRequest | null) => void
}

export async function completeAdminUploadSession(
  options: CompleteAdminUploadOptions,
): Promise<AdminUploadResult> {
  const { session, upload } = options.created.data
  options.onCreated?.(options.created)
  options.onStage('uploading')
  options.onProgress(0)

  let status: number
  try {
    status = await putFileToSignedUrl(
      upload,
      options.file,
      options.onProgress,
      options.registerXhr ?? (() => {}),
    )
  }
  catch {
    return { ok: false, step: 'put', reason: 'network' }
  }
  finally {
    options.onProgress(null)
    options.registerXhr?.(null)
  }

  if (status === 403) {
    return { ok: false, step: 'put', reason: 'expired' }
  }
  if (status < 200 || status >= 300) {
    return { ok: false, step: 'put', reason: 'rejected' }
  }

  options.onStage('validating')
  try {
    const completed = await options.adminApi(
      `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}/complete`,
      {
        method: 'POST',
        body: {
          expectedVersion: session.version,
          payload: { focalX: 0.5, focalY: 0.5 },
        },
        schema: completeUploadSessionResponseSchema,
      },
    )
    return {
      ok: true,
      asset: completed.data.asset,
      session: completed.data.session,
    }
  }
  catch (error) {
    const current = error instanceof AdminApiError
      && (error.status === 400 || error.status === 409)
      ? await options.adminApi(
          `/api/admin/v1/media/upload-sessions/${session.uploadSessionId}`,
          { schema: uploadSessionResponseSchema },
        ).catch(() => null)
      : null
    return {
      ok: false,
      step: 'complete',
      error,
      session: current?.data ?? null,
    }
  }
}

export async function runAdminUploadSession(options: {
  adminApi: AdminApi
  createSession: (declaration: UploadDeclaration) => Promise<AdminUploadCreated>
  file: File
  onCreated?: CompleteAdminUploadOptions['onCreated']
  onProgress: CompleteAdminUploadOptions['onProgress']
  onStage: (stage: 'digesting' | 'uploading' | 'validating') => void
  registerXhr?: CompleteAdminUploadOptions['registerXhr']
  validate?: (
    declaration: UploadDeclaration,
    file: File,
  ) => Promise<string | null> | string | null
}): Promise<AdminUploadResult> {
  options.onStage('digesting')
  const declared = await buildUploadDeclaration(options.file)
  if (!declared.ok) {
    return { ok: false, step: 'declaration', reason: declared.reason }
  }
  const validationMessage = await options.validate?.(
    declared.declaration,
    options.file,
  )
  if (validationMessage) {
    return { ok: false, step: 'validation', message: validationMessage }
  }

  let created: AdminUploadCreated
  try {
    created = await options.createSession(declared.declaration)
  }
  catch (error) {
    return { ok: false, step: 'create', error }
  }
  return completeAdminUploadSession({
    adminApi: options.adminApi,
    created,
    file: options.file,
    onProgress: options.onProgress,
    onStage: options.onStage,
    ...(options.onCreated ? { onCreated: options.onCreated } : {}),
    ...(options.registerXhr ? { registerXhr: options.registerXhr } : {}),
  })
}
