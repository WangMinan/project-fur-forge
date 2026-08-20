import type { R3StageAObjectStore } from './runner/r3-stage-a-retirement'
import { AliOssR3StageAObjectStore } from './r3-stage-a-remote-cleanup'
import { getRuntimeConfig } from './runtime-config'

let exactObjectStore: R3StageAObjectStore | undefined

export function getExactObjectStore() {
  exactObjectStore ??= new AliOssR3StageAObjectStore(getRuntimeConfig())
  return exactObjectStore
}

export function setExactObjectStoreForTesting(
  store: R3StageAObjectStore | undefined,
) {
  if (getRuntimeConfig().appEnv !== 'test') {
    throw new Error('Exact object storage override requires APP_ENV=test.')
  }
  exactObjectStore = store
}
