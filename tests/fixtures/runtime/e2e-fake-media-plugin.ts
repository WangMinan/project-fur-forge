import { installE2eFakeMediaStorage } from './e2e-fake-media'

// test 构建启动即安装内存 fake，保证第一个上传会话请求命中 fake 而不是真实 OSS。
export default function () {
  installE2eFakeMediaStorage()
}
