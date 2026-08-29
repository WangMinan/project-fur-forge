import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type {
  UploadSessionDto,
  VerifiedAssetDto,
} from '../../shared/types/contracts'
import {
  finishAdminUploadSession,
} from '../../app/utils/admin-upload-session'
import {
  AdminApiError,
} from '../../app/composables/useAdminApi'
import type {
  AdminApi,
} from '../../app/composables/useAdminApi'

const uploadSession: UploadSessionDto = {
  uploadSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner: { type: 'site', id: 'hero-home-portrait' },
  ownerVersion: 1,
  mediaRole: 'home_hero_portrait',
  expected: {
    contentType: 'image/png',
    byteSize: 23_000_000,
    contentMd5: 'AAAAAAAAAAAAAAAAAAAAAA==',
    sha256: 'a'.repeat(64),
    width: 4_173,
    height: 5_902,
  },
  createdBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  status: 'AWAITING_UPLOAD',
  version: 1,
  failureCode: null,
  failureStage: null,
  assetId: null,
  createdAt: '2026-08-27T00:00:00.000Z',
  expiresAt: '2026-08-27T01:00:00.000Z',
}

const asset: VerifiedAssetDto = {
  assetId: uploadSession.uploadSessionId,
  version: 1,
  role: 'home_hero_portrait',
  status: 'READY',
  mimeType: 'image/png',
  byteSize: uploadSession.expected.byteSize,
  width: uploadSession.expected.width,
  height: uploadSession.expected.height,
  exifOrientation: 1,
  focalX: 0.5,
  focalY: 0.5,
  fitMode: 'cover',
  processingFailureCode: null,
  processingFailureStage: null,
  previews: [{
    usage: 'home-hero-portrait',
    aspect: '9:16',
    fitMode: 'cover',
  }],
}

afterEach(() => vi.useRealTimers())

describe('admin upload completion recovery', () => {
  it('recovers the completed asset after the original response connection closes', async () => {
    vi.useFakeTimers()
    let sessionReads = 0
    const adminApi = vi.fn(async (path: string) => {
      if (path.endsWith('/complete')) {
        throw new AdminApiError(null, null)
      }
      if (path.includes('/upload-sessions/')) {
        sessionReads += 1
        return {
          data: sessionReads === 1
            ? { ...uploadSession, status: 'VALIDATING', version: 2 }
            : {
                ...uploadSession,
                status: 'COMPLETED',
                version: 3,
                assetId: asset.assetId,
              },
        }
      }
      return { data: asset }
    }) as unknown as AdminApi

    const resultPromise = finishAdminUploadSession({
      adminApi,
      session: uploadSession,
    })
    await vi.runAllTimersAsync()

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      asset: { assetId: asset.assetId, status: 'READY' },
      session: { status: 'COMPLETED' },
    })
    expect(sessionReads).toBe(2)
  })
})
