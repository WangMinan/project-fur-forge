import { expect, test } from '@playwright/test'

test('返图墙每个无 seed 请求重新随机，并保留显式分页 seed', async ({ request }) => {
  const firstResponse = await request.get('/api/public/v1/returns')
  const secondResponse = await request.get('/api/public/v1/returns')
  expect(firstResponse.status()).toBe(200)
  expect(secondResponse.status()).toBe(200)

  const first = (await firstResponse.json()).data as { seed: string }
  const second = (await secondResponse.json()).data as { seed: string }
  expect(first.seed).toMatch(/^[0-9a-f]{32}$/u)
  expect(second.seed).toMatch(/^[0-9a-f]{32}$/u)
  expect(second.seed).not.toBe(first.seed)

  const pagedResponse = await request.get(
    `/api/public/v1/returns?page=2&seed=${first.seed}`,
  )
  expect(pagedResponse.status()).toBe(200)
  expect((await pagedResponse.json()).data).toMatchObject({
    page: 2,
    seed: first.seed,
  })
})
