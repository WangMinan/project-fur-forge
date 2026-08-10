# T51-F4 工程记录 · FFmpeg 可见进度与作品竖图水印

> 日期：2026-08-10
> 基线：`f6f6a672ca6c1af16634aa11017d144244732edc`（写入前本地 `main` 与 `origin/main` 一致）
> 角色：实现与工程自测；不代签 T49 新上下文独立 Review，也不等于用户验收或正式发布

## 范围与结论

管理端触发 FFmpeg 后不再只锁定按钮。大文件上传私有预处理、首页横竖图放大、低分辨率设定图/出厂照发布适配，以及失败后的处理重试，都显示统一的不定量进度条、当前对象/阶段和已等待时间；OSS 字节上传百分比与公开变体计数仍显示真实进度，不用估算值冒充 FFmpeg 百分比。

作品公开水印升级为 `recipe-v3`。3:4 `work-card` 以 480 px 档位、竖版 `studio_photo` `detail` 以 960 px 档位为参考随输出宽度等比放大，仍严格只有一个 `center` 水印；横版详情保持原单居中尺寸，设定图保持左右两个水印。工程结果 PASS，T49 独立 Review 保持开放。

## 实现

- 新增复用的 `AdminFfmpegProgress`，以动态等待条和经过时间覆盖作品、返图、Hero 上传/适配和处理重试；用户确认操作后、服务端 operation 尚未返回前也立即显示反馈；
- `ffmpeg-static` 从同步 `spawnSync` 改为异步 `spawn`，继续只使用固定绝对 binary，不查 PATH；保留 120 秒超时、30 MB 输出上限、有限错误缓冲和安全错误，binary 摘要改为流式异步读取；
- 媒体完成、Hero 放大和作品适配调用链全部 `await` 异步结果，使 Nitro 在 CPU 处理期间仍可响应 operation/发布检查轮询；
- `recipe-v3` 把作品卡和竖版详情的水印宽度按输出档位缩放，处理串断言同时守住“一个中心水印”；横版详情与设定图双水印行为不变；
- 新像素写入新不可变 Key。公开投影只选择一套完整 SourceSet：优先 v3，缺失时整体回退完整 v2，再回退 v1，绝不跨版本拼接；首页历史 v2 水印集继续被兼容校验接受；
- 现存 v2 对象不会被原地覆盖或后台静默批量改写；在对应作品重新发布或下一次全局水印重建生成完整 v3 前，公开页继续整体消费完整 v2。

## 首次失败与修复

1. 首轮首页浏览器断言在注入即时存储失败时看不到等待条：服务端过快进入失败，客户端只依赖 operation 响应。修复为确认/重试请求发出时先设置该卡片的 FFmpeg pending 状态，响应后再交给持久 operation；重跑通过。
2. 首轮完整 integration 有 3 项首页 Schema 用例失败：全局配方版本升级后，校验入口只接受当前 v3，错误拒绝历史完整 v2。修复为当前完整集优先、v2/v1 完整集整体回退；定向 14/14 与最终整套 171/171 通过。

历史失败被保留在本记录中；后续 PASS 不删除首次 NOT PASS 事实。

## 测试与证据

- `APP_ENV=test pnpm lint`：通过；
- `APP_ENV=test pnpm typecheck`：通过；
- `APP_ENV=test pnpm test`：29 个文件、163 项全部通过；包含 FFmpeg 运行期间 event loop 定时器可先执行的回归；
- `APP_ENV=test pnpm test:integration`：20 个文件、171 项全部通过；覆盖配方处理串、竖/横几何、单/双水印数量、不可变 Key、完整 v2 回退、不混 SourceSet、发布与历史 Hero 兼容；
- 复用当轮构建产物执行 5 项管理端 Playwright：大于 20 MB 上传、失败重试、低清 Hero、低清出厂照发布、低清设定图发布，5/5 通过；断言请求未完成时等待条和经过时间可见；
- `APP_ENV=production pnpm build`：通过，production content guard 同步通过；`.output/server/package.json` 保留 `ffmpeg-static@5.3.0`，本机产物包含固定 binary；
- `APP_ENV=test pnpm run verify:production`：通过，health、公开 SSR/API 与管理 CSR 基线正常。

本轮没有运行真实 OSS/ESA live、没有部署、没有创建 tag、没有签署 T49、T50、GATE-E 或用户验收。
