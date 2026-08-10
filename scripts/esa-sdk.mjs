import * as EsaSdkNamespace from '@alicloud/esa20240910'

const moduleDefault = EsaSdkNamespace.default
const commonJsExports = (
  moduleDefault !== null
  && typeof moduleDefault === 'object'
)
  ? moduleDefault
  : undefined

export const EsaClient = typeof moduleDefault === 'function'
  ? moduleDefault
  : commonJsExports?.default
export const DescribePurgeTasksRequest = (
  EsaSdkNamespace.DescribePurgeTasksRequest
  ?? commonJsExports?.DescribePurgeTasksRequest
)
export const PurgeCachesRequest = (
  EsaSdkNamespace.PurgeCachesRequest
  ?? commonJsExports?.PurgeCachesRequest
)
export const PurgeCachesRequestContent = (
  EsaSdkNamespace.PurgeCachesRequestContent
  ?? commonJsExports?.PurgeCachesRequestContent
)

for (const [name, value] of Object.entries({
  EsaClient,
  DescribePurgeTasksRequest,
  PurgeCachesRequest,
  PurgeCachesRequestContent,
})) {
  if (typeof value !== 'function') {
    throw new TypeError(`Alibaba Cloud ESA SDK export ${name} is not constructible.`)
  }
}
