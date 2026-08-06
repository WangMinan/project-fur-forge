import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import type { H3Event } from 'h3'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { readAdminJsonBody } from '../../server/utils/route/request-body'

describe('admin JSON request body', () => {
  it('rejects interrupted requests and removes every listener', async () => {
    vi.stubGlobal('createError', (input: Record<string, unknown>) => (
      Object.assign(new Error(), input)
    ))
    const request = new EventEmitter() as IncomingMessage
    request.headers = {}
    const pending = readAdminJsonBody({
      node: { req: request },
    } as H3Event)

    request.emit('aborted')

    await expect(pending).rejects.toMatchObject({
      statusCode: 400,
      data: { code: 'VALIDATION_ERROR' },
    })
    for (const event of ['data', 'end', 'error', 'aborted', 'close']) {
      expect(request.listenerCount(event)).toBe(0)
    }
    vi.unstubAllGlobals()
  })
})
