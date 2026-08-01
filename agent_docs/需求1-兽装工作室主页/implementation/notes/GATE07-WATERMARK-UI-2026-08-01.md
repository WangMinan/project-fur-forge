# GATE-07 水印管理 UI 实现记录（2026-08-01）

> 执行人：Kimi K3（UI_PRIMARY）。分支 `feature/gate07-watermark-ui-kimi`。
> 依据 `implementation/notes/GATE07-UI-HANDOFF.md`；不勾选 GATE-07，不启动 T19/T20。

## 范围与边界

只做两件事：`/admin/site/branding` 管理页 + 移除作品编辑器的 v1 四角控件。
未触碰：数据库/迁移、服务端 profile 规则、OSS process 字符串、权限/Host/Origin/CSRF、
资源版本、发布/切换事务、错误码。所有写请求沿用既有 `expectedVersion` + 内存 CSRF；
409 一律重新 GET branding，不自行递增版本。

## 实现清单

### 站点品牌入口

- `app/components/AdminShell.vue`：`current` 增加 `'branding'`，导航在「作品」与「账号」之间
  增加「站点品牌」→ `/admin/site/branding`（能力真实可用后才出现，符合壳注释约束）。
- `app/pages/admin/site/branding.vue`：页面装配与表单状态（候选选择、不透明度、缩放、
  dirty 基线、409 冲突横幅）。`layout: admin`、`ssr: false`、`noindex`。

### 页面区块（`app/components/admin/`）

- 当前活动水印（页面内联）：活动候选缩略图（同源 `previewUrl`）、profile 名、居中、
  当前不透明度/缩放、活动时间、状态徽章；草稿行并列展示。
- `BrandingCandidatesCard.vue`：透明 PNG 上传（浏览器基础检查：类型/20 MB/可解码/
  边长/透明像素采样 → 真实 MD5+SHA-256 摘要 → V4 条件直传 → 服务端核验）、候选列表、
  当前使用/草稿徽章、单选草稿选择。不展示路径、Key、Bucket、签名 URL。
- `BrandingParamsCard.vue`：不透明度 10–90（默认 50）、缩放 20–90（默认 60），
  数字输入与滑块双向同步；位置只读「居中（固定）」；无关闭按钮、无四角选项；
  本地越界与服务端 400 错误经 `aria-describedby` + `role=alert` 与控件程序化关联；
  措辞统一为「不透明度」。
- `BrandingPreviewCard.vue`：调用真实预览 API，四比例（作品卡片 3:4、详情原比例、
  首页横屏 16:9、首页竖屏 9:16）只用操作返回的同源 `previews[].url` 渲染，无 CSS 叠层；
  loading/失败重试/过期（img error → 「预览已过期，请重新生成」）；点击放大对话框
  （Escape 关闭、焦点归还）；短时 URL 只存内存，不持久化。
- `BrandingApplyCard.vue`：影响摘要（受影响作品数/首页轮播项数/目标 variant 总数/
  当前公开 profile/新草稿 profile，数量均来自服务端 `impact`，不写死）；
  「切换前旧公开图保持可用、完成后旧对象进入清理」说明；`AdminConfirmDialog` 显式确认；
  操作区 `role=status` + `aria-live` 持续播报阶段与 已生成/已核验/待清理 计数；
  失败按 `failureCode` 给中文动作提示并持续显示，可重试；完成非 Toast；
  常显「当前公开站使用：…」；<768px 显示「建议改用桌面端完成应用操作」提示。

### 状态与上传 composables

- `app/composables/useWatermarkBranding.ts`：branding 快照为唯一状态基线；
  创建草稿/预览/应用/重试；`lastOperationId` 页面重载恢复；进行中状态 2s 轮询；
  409 → 冲突提示 + 重新 GET。
- `app/composables/useWatermarkLogoUpload.ts`：单文件候选上传状态机
  （digesting/uploading/validating/done/failed + 失败文案）。
- `app/utils/signed-put.ts`：从 `useStudioPhotoUpload` 抽出的条件 PUT 共用实现
  （逐字复制条件头；签名 URL 不持久化）；原 composable 改为复用。
- `app/utils/watermark-labels.ts`：profile/操作状态、失败码、预览比例的中文映射与时间格式化。

### 作品编辑器

- `StudioPhotoCard.vue`：删除「水印安全角」下拉；新增「公开衍生图未生成」明确状态
  （>0 时仍显示数量）。
- `StudioPhotoSection.vue`：保存载荷不再包含 `watermarkAnchor`；头部新增只读摘要
  「当前公开水印：居中 · 不透明度 X% · 缩放 Y%」（来自 branding 活动 profile）。
- `useStudioPhotoUpload.ts`：complete 载荷不再发送 `watermarkAnchor`（服务端已标 optional）。

## 接口缺口（已停下对应部分，交回工程侧）

1. **候选删除**：需求要求「删除未引用候选」，但服务端没有候选删除路由
   （`watermark-assets/[id]/` 下仅有 `preview.get.ts`）。UI 未渲染任何删除入口。
   建议补：`DELETE /api/admin/v1/site/branding/watermark-assets/{assetId}`，
   请求体 `{ expectedVersion: number, payload: {} }`（branding 版本）；
   仅当候选未被任何 ACTIVE/DRAFT/APPLYING profile 引用时删除私有对象与 asset 行，
   成功返回更新后的 branding 快照或 204；被引用时 409。
2. **作品编辑器「真实公开 variant 预览」**：管理端没有按 asset 取公开衍生图的同源路由
   （`media/assets/[id]/preview` 是私有原图；公开投影属 T19）。编辑器目前提供
   「公开衍生图 N 张 / 未生成」明确状态。建议补：
   `GET /api/admin/v1/media/assets/{assetId}/public-variant?usage=work-card`，
   返回当前活动 profile 的公开 variant 图片字节（同源、带 `Cache-Control: no-store`），
   不存在时 404，UI 据此显示「未生成」。

## 测试

### 新增 `tests/e2e/admin-branding.spec.ts`（13 例，串行，真实浏览器 + 真实 branding API）

未认证重定向 + API 401；初始状态（活动 profile、默认 50/60、固定居中、无关闭/四角）；
透明 PNG 上传与草稿选择、保存草稿；非法参数本地拦截与双控件同步；四比例真实预览
（同源 URL、图片真实解码、放大查看 + Escape）；应用确认对话框（影响摘要、焦点落在确认钮、
Enter 确认）、原子切换与防重复（无草稿时应用禁用）；`failProcess` 生成失败 → 旧活动
profile 保持 → 重试完成；`failDelete` 清理失败 → 重载恢复失败态 → 重试仅清理；
DOM/图片 URL 无私有 Key/Bucket/签名 URL/完整摘要/OSS process；作品编辑器无四角控件、
只读摘要、保存不依赖 `watermarkAnchor`；390/768/1440 无横向溢出 + 390 桌面提示；
键盘 Tab 顺序与主要控件聚焦；reduced-motion 下预览不自动切换。

### 测试基础设施（仅 test 构建注册）

- `tests/fixtures/runtime/e2e-fake-media-control.ts`：新增 `seedBrandingStage` 动作
  （首页轮播管理 API 属 T20，只能直接落库）：种入已发布作品照 + 启用横竖首页图并预生成
  当前活动 profile 的公开 variant；按 key 前缀自清理上一轮舞台数据（reset 只清 fake
  对象、保留 DB 行，不清理会让旧资产成为失效发布目标）。
- `tests/helpers/fake-media-storage.ts`：`process` 输出从哈希字节改为真实可解码的
  8×8 webp/jpg/png（尺寸元数据仍按 process 参数推导），浏览器可真实加载预览图。
- `tests/e2e/helpers/screenshots.ts`：`capture` 增加可选目录参数。
- `tests/e2e/admin-media.spec.ts`：移除水印角交互与断言（控件已删）。

## 证据

`implementation/notes/gate07-watermark/screenshots/`：

- `branding-initial-1440x900.png`：初始活动水印 + 默认参数 + 候选列表。
- `branding-draft-saved-1440x900.png`：上传候选 + 草稿已选 + 草稿行。
- `branding-preview-1440x900.png`：四比例真实预览 + 影响摘要。
- `branding-applied-1440x900.png`：应用完成 + 当前公开站使用新配置。
- `branding-390x844.png` / `branding-768x1024.png` / `branding-1440x900.png`：三视口。
- `branding-reduced-motion-1440x900.png`：reduced-motion。

注：截图中候选列表第二行是早前用例上传、对象已被 reset 清除的候选，缩略图破图属
E2E 夹具行为，生产环境不存在该路径。

## 门禁结果

- `pnpm lint` / `pnpm typecheck`：通过（0 错误 0 警告）。
- `pnpm test`：76 通过。`pnpm test:integration`：68 通过。
- `pnpm test:e2e`：144 通过 0 失败（含新增 13 例品牌页用例）。
- `pnpm build` / `pnpm verify:production`：通过。
