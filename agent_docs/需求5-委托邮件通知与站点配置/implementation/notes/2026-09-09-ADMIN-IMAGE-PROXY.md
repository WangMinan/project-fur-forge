# 管理图片同源回传与预览尺寸修复

用户明确要求直接在 `main` 回滚 PR #31 的管理图片直读方案；只撤回图片传输链路，保留邮件超时/停止修复与随后合入的发布计时/ESA 清理修复。本地实现未涉及迁移、生产数据、云配置、生产部署或真实发信。用户验证完成后另行明确授权 commit、push 并启动一次 `release-image.yml`；运行结果以 GitHub 为准，不将启动记录代签为镜像已发布。

## 定位与实现

- 本地只读 OSS 原图请求返回 `Content-Disposition: attachment`、`x-oss-force-download: true` 与 `0048-00000105`；签名显式请求 inline 仍被覆盖。未记录签名、对象 Key 或真实委托资料。
- 管理图片恢复原有同源 `<img>` 入口，由 app 经 OSS SDK 返回字节。移除浏览器 GET 签名 DTO、重签名 composable 和直读组件；上传继续通过 OSS 条件 PUT。
- 列表/卡片 320；出厂照 640；Hero 大图编辑、作品设定图、领养封面及委托详情 1280。宽度仅接受固定白名单，私有缩略处理源沿用现有解析；处理失败不回退原图。
- 原图入口返回可信图片 MIME 与 `Content-Disposition: inline`，保留新窗口原生图片预览；委托无参数旧链接仍读原图，邮件附件与工作单不变。
- 图片请求及被动会话检查仍不续 Cookie 或延长八小时闲置期限。Hero 临时裁切预览保留到期与 READY 校验。
- 同步稳定入口、媒体策略、部署手册、环境示例及需求5 STATE/TASKS；历史直读记录明确标注已被取代。

## 验证

- `pnpm lint` 与 `pnpm typecheck` 通过；后续上传恢复尺寸与图片响应头调整再次通过受影响文件 lint、完整 typecheck。
- 受影响 core：8 文件、44 项通过，覆盖预览宽度/非法参数、会话权限、存储端点、Hero 私有临时预览与到期、委托处理、工作单及邮件通知；未向真实邮箱发信。
- `pnpm build` 通过，最终源码补充后重新构建通过；production 内容隔离校验通过。
- `pnpm exec playwright test tests/e2e/admin-private-images.spec.ts`：3 项通过。覆盖委托 1280 同源预览、作品设定图/封面 1280、出厂照 640、作品列表 320、Hero 编辑 1280；委托和作品原图实际点击新标签页后成功解码，没有下载事件，响应 200/inline/no-store 且不续 Cookie。非法参数与未登录图片读取被拒绝。
- 委托详情完成 390×844、430×932、768×1024、1023×900、1024×900、1440×900、3840×2160 图片解码与水平溢出检查，并查看七份截图。截图使用虚构资料，保存在忽略的 `test-results/admin-private-images-commi-96acd-original-image-in-a-new-tab/`。
- 本地真实 OSS 只读验证：复用现有 `processingSource` 与 `AliOssMediaStorage.getPrivateProcessed`，`w_1280` 返回 1280×695 PNG，1,211,414 字节。未保存图片、对象 Key、签名或真实资料。
- 文档本地链接与 `git diff --check` 通过。以上是提交前的本地验证；随后用户确认验证完成，授权提交推送和镜像工作流。独立 Review、远程 CI 与生产运行状态不由本地测试代签。

图片字节重新经过应用服务器，1280 也不保证所有 4K/高 DPR 显示比例下达到原图细节；本次按用户指定档位实现，完整细节通过新窗口原图查看。浏览器专项使用内存 OSS fake，只读真实 OSS 检查单独记录，不将 fake 的源图片尺寸冒充实际缩略像素。
