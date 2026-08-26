import {
  completeUploadSessionResponseSchema,
  uploadSessionResponseSchema,
  verifiedAssetResponseSchema,
} from '~~/shared/schemas/upload'
import type {
  ConditionalPutDto,
  UploadSessionDto,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import type { AdminApi } from '../composables/useAdminApi'
import { AdminApiError } from '../composables/useAdminApi'
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

const COMPLETION_POLL_INTERVAL_MS = 1_000
const COMPLETION_POLL_ATTEMPTS = 180

async function recoverAdminUploadCompletion(
  adminApi: AdminApi,
  uploadSessionId: string,
) {
  let session: UploadSessionDto | null = null
  for (let attempt = 0; attempt < COMPLETION_POLL_ATTEMPTS; attempt += 1) {
    const fresh = await adminApi(
      `/api/admin/v1/media/upload-sessions/${uploadSessionId}`,
      { schema: uploadSessionResponseSchema },
    ).catch(() => null)
    if (!fresh) {
      return { asset: null, session }
    }
    session = fresh.data
    if (session.status === 'COMPLETED' && session.assetId) {
      const recovered = await adminApi(
        `/api/admin/v1/media/assets/${session.assetId}`,
        { schema: verifiedAssetResponseSchema },
      ).catch(() => null)
      return { asset: recovered?.data ?? null, session }
    }
    if (session.status !== 'VALIDATING') {
      return { asset: null, session }
    }
    if (attempt + 1 < COMPLETION_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, COMPLETION_POLL_INTERVAL_MS))
    }
  }
  return { asset: null, session }
}

export async function finishAdminUploadSession(options: {
  adminApi: AdminApi
  session: UploadSessionDto
}): Promise<AdminUploadResult> {
  let session = options.session
  let completionError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      completionError = error
      if (error instanceof AdminApiError && error.status === 401) {
        break
      }
      const recovered = await recoverAdminUploadCompletion(
        options.adminApi,
        session.uploadSessionId,
      )
      if (recovered.asset && recovered.session) {
        return {
          ok: true,
          asset: recovered.asset,
          session: recovered.session,
        }
      }
      if (attempt === 0 && recovered.session?.status === 'AWAITING_UPLOAD') {
        session = recovered.session
        continue
      }
      return {
        ok: false,
        step: 'complete',
        error,
        session: recovered.session,
      }
    }
  }
  return {
    ok: false,
    step: 'complete',
    error: completionError,
    session: null,
  }
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
  return finishAdminUploadSession({ adminApi: options.adminApi, session })
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
