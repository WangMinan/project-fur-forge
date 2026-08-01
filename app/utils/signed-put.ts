import type { ConditionalPutDto } from '~~/shared/types/contracts'

// 条件直传：逐字复制服务端给出的条件头，不附加 Session/CSRF 或业务 JSON。
// 签名 URL 只在当前上传动作的内存中短暂存在，不持久化、不上报。
export function putFileToSignedUrl(
  upload: ConditionalPutDto,
  file: File,
  onProgress: (ratio: number) => void,
  registerXhr: (xhr: XMLHttpRequest | null) => void,
) {
  return new Promise<number>((resolvePromise, rejectPromise) => {
    const xhr = new XMLHttpRequest()
    registerXhr(xhr)
    xhr.open('PUT', upload.url)
    for (const [name, value] of Object.entries(upload.headers)) {
      xhr.setRequestHeader(name, value)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    }
    xhr.onload = () => resolvePromise(xhr.status)
    xhr.onerror = () => rejectPromise(new Error('upload network failure'))
    xhr.onabort = () => rejectPromise(new Error('upload aborted'))
    xhr.send(file)
  })
}
