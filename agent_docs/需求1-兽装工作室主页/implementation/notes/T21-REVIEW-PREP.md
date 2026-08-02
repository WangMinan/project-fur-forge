# T21 第一垂直切片独立复审准备

> 状态：首次独立审查已执行并判定 NOT PASS；findings 已完成实现者侧修复与复验，等待独立复审，T21 未勾选。
> 执行者：必须是未参与 T19/T20 实现的独立 `REVIEW`；实现者不得代签。

## 审查输入

- 契约：`foundation/README.md`、`requirements/SPEC.md`、`planning/PLAN.md` 及 `WATERMARK-CENTERED-V2.md` 增量。
- 实现边界：`implementation/TASKS.md` 的 T21、`implementation/EXECUTION_ROUTING.md`。
- 首次审查与复审条件：`implementation/notes/T21-REVIEW-2026-08-01.md`。
- 实现者证据：`implementation/notes/T19-T20-CLOSURE-2026-08-01.md`、T19/T20 工程/UI 记录和 `t19-t20/screenshots/`；这些材料只能作为输入，不能替代独立证据。
- 审查对象：最终待审工作树/提交差异，不仅是实现者记录或测试通过数量。

## 首次 findings 必须逐项重放

1. 管理页预览的 DTO、DOM、响应头和日志只能出现同源代理 URL，不得出现私有签名 URL、Bucket、Object Key 或上传会话。
2. 480×640 等不能满足固定配方的 READY 源必须在发布前返回 409，且不得创建 publication operation。
3. 仍被启用首页项引用的作品下架必须返回 409；非预期下架异常必须持久化为 FAILED，不得留下 COMMITTING。
4. 横竖预览必须有持久清单；替换、删除、启用、取消及失败恢复均按确切 key 清理，不能依赖 Bucket 列举。

## 必须独立重放的主链

1. 唯一系统临时空库迁移并初始化管理员；验证迁移记录和外键完整性。
2. 创建作品，完成私有条件直传与服务端媒体核验；匿名私有读取必须失败。
3. 用真实 OSS 和当前活动 `brand-centered-v2` 生成作品公开 variant；确认大尺寸居中水印未遮毁关键内容。
4. 发布作品；用新的普通公开请求验证详情、列表和精选立即出现，页面核心内容在 SSR HTML，公开媒体只来自活动 profile。
5. 配置一项横竖独立首页轮播；启用前必须有两方向完整活动 profile variant，私有预览不得被公开投影引用。
6. 用新访客横屏与竖屏浏览；确认隐藏方向首屏大图不下载、自动轮播默认关闭、暂停/焦点/键盘/reduced-motion、CLS、对比度和三视口布局。
7. 在 `/admin/site/branding` 更换一次 Logo 候选并应用；失败时旧 profile 持续公开，完整生成后才原子切换，长任务显示真实可恢复进度。
8. 下架作品；用新普通请求确认详情/列表/精选/首页投影消失，再精确清理本次已知对象与临时 DB。

实现者最新准备证据为：OSS 基线 run `t10-20260802T122843Z-379c1a65`、水印 run `gate07-20260802T122908Z-f04ba5f9`、完整作品/首页/下架纵向链 run `t19t20-20260802T123825Z-06ced050`。独立审查者必须使用新的 run、对象前缀和临时 DB 重放，不得复用上述结果签字。

## 安全与泄漏复核

- 页面错误必须是 HTML，API 错误必须是 JSON。
- 公开 SSR、DOM、响应头、构建资源和日志不得出现联系人、Access Key/Secret、签名 URL、上传会话、草稿或生产 fixture。
- 管理 API 必须复核认证、CSRF、`expectedVersion` 和 `no-store`；Host/origin 边界不得因测试媒体源放宽到生产。
- OSS 清理只能使用本次记录的确切 key，不得列举或模糊删除 Bucket。

## 建议命令

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm preflight:oss
pnpm preflight:watermark
```

## 审查输出规则

- 先按严重级别登记 findings，附文件/行号、复现路径和证据；没有问题时也要逐项写明已打开的页面、日志、截图与真实 OSS 结果。
- 当前导航包含 T22 以后才实现的预留路由，测试服务器可能输出未匹配警告；审查者应区分既定后续范围与 T19/T20 回归。T21 不得把 T22 才提供的管理端精选写入能力假装为当前已实现能力；如需验证精选读取，只能明确记录为审查数据准备。
- 本准备文件不得用于勾选 T21。只有独立重放、问题闭环和用户验收完成后，才能更新 `TASKS.md`、`STATE.md`、`EXECUTION_ROUTING.md` 与 `ARTIFACTS.md`。
