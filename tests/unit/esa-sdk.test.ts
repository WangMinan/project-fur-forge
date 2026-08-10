import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('Alibaba Cloud ESA SDK Node ESM interop', () => {
  it('constructs the client and purge requests in a native Node ESM process', () => {
    const sdkUrl = pathToFileURL(
      resolve(process.cwd(), 'scripts/esa-sdk.mjs'),
    ).href
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import {
            EsaClient,
            DescribePurgeTasksRequest,
            PurgeCachesRequest,
            PurgeCachesRequestContent,
          } from ${JSON.stringify(sdkUrl)}

          const client = new EsaClient({
            accessKeyId: 'native-esm-test-id',
            accessKeySecret: 'native-esm-test-secret',
            endpoint: 'esa.cn-hangzhou.aliyuncs.com',
            protocol: 'HTTPS',
            regionId: 'cn-hangzhou',
          })
          const content = new PurgeCachesRequestContent({
            files: ['https://public-media.ditedog.com/prod/web/test.webp'],
          })
          const purge = new PurgeCachesRequest({
            siteId: 1234567890,
            type: 'file',
            content,
          })
          const describe = new DescribePurgeTasksRequest({
            siteId: 1234567890,
            type: 'file',
          })

          if (
            typeof client.purgeCaches !== 'function'
            || purge.type !== 'file'
            || describe.type !== 'file'
          ) {
            throw new Error('ESA SDK constructors did not preserve their runtime contract.')
          }
        `,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
