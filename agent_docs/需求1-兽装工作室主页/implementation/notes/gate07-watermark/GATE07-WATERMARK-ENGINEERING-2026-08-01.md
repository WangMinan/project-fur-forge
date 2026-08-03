# GATE-07 居中水印工程记录（2026-08-01）

> 本记录只证明 GATE-07 的工程侧实现与验证已完成。`/admin/site/branding` 管理界面、三视口视觉证据和用户确认尚未完成，因此 GATE-07 保持未勾选；T19/T20 未启动。

## 1. 执行基线与边界

- 基线：`f25c9e5129442b08de28230b95a1413595bf4d80`。
- 分支：`feature/gate07-watermark-engineering-sol`。
- 实现范围：水印候选资产、不可变 profile、站点活动/草稿引用、预览/重建操作、OSS 处理、原子切换、精确清理、发布门禁、接口与测试。
- 未修改 Kimi 页面；未实现 `/admin/site/branding`；未启动 T19/T20；未勾选 GATE-07。

## 2. 数据与迁移

迁移 `server/database/migrations/0007_fearless_bucky.sql` 新增：

- `watermark_profiles`：固定 `brand-centered-v2`、固定 `center`，不透明度 10%–90%，缩放 20%–90%，Logo/配置摘要、状态和资源版本；数据库触发器禁止修改 profile identity，并约束状态迁移。
- `site_branding`：单例站点记录，保存活动 profile、草稿 profile、最近操作和资源版本。
- `watermark_operations`：保存预览/重建的阶段、影响数量、生成/核验进度、清理清单、安全失败码和资源版本。
- `assets` / `upload_sessions`：增加站点级 `watermark_logo` 角色及所有权约束；候选只接受不超过 20 MB、带透明通道的 PNG。
- `asset_variants`：保留历史 `brand-standard-v1` 身份，同时加入 profile ID、配置摘要、中心位置、不透明度和缩放身份；v1 与 v2 使用独立唯一索引。

当前随应用 Logo 仅作为初始导入源，不再参与运行期媒体身份。部署顺序：

```bash
pnpm db:migrate
pnpm watermark:seed
```

种子脚本幂等写入私有 Bucket 与数据库。空站点自动得到活动的 50%/60% profile；已有发布内容的站点只生成草稿，必须经过预览和应用流程，避免绕过完整再生成与原子切换。

## 3. 服务端实现

- `/api/admin/v1/site/branding/**` 提供站点水印读取、候选上传、候选安全预览、profile 创建、四比例预览、应用、操作进度和失败重试。
- 管理端接口沿用现有唯一管理员 Session、Host/Origin/CSRF、`no-store`、`noindex` 和统一错误信封。
- 候选源和样张均通过受保护的同源 API 代理；DTO 不返回 Bucket、Object Key、完整摘要、签名 URL、OSS process 或底层错误。
- `brand-centered-v2` 使用 Logo 宽度相对目标图缩放、`g_center` 和不透明度参数；所有配置进入 variant identity 和目标 Key。
- 预览在私有 Bucket 生成并验证 `work-card`、`detail`、`home-hero-landscape`、`home-hero-portrait` 四种比例，随后由受保护接口读取。
- 应用先在事务外完整生成和验证全部公开目标，再用短事务切换活动 profile；切换前失败继续使用旧 profile，切换后精确清理旧 variant 与预览。清理失败持久化为可重试操作，不回滚已完成的新 profile。
- 重复应用同一活动 profile 返回既有完成操作，不重复生成。
- 发布检查和公开 DTO 只接受当前活动的 v2 identity；历史 v1 继续可追溯，但不再满足当前发布条件。
- 私有原图和私有预处理源保持无水印，OSS 仍是公开 variant 的像素权威。

## 4. 真实 OSS 证据

命令：`pnpm preflight:watermark`。

- 最终运行：`gate07-20260801T074754Z-e6eb2cff`。
- 私有输入：工作室样张、横版样张、竖版样张和当前 Logo；匿名读取均被拒绝。
- 结果核验：作品卡片 `480×640`、详情 `960×1280`、首页横版 `768×432`、首页竖版 `480×853`。
- 四个结果均由 OSS 使用 `brand-centered-v2`、`center`、50% 不透明度和 60% 缩放生成并完成格式/尺寸核验。
- 全程未依赖 ListObjects；本次创建的 8 个精确对象全部删除；证据不记录凭据、Bucket 或完整 Object Key。
- 本地忽略证据：`test-results/oss-watermark/gate07-20260801T074754Z-e6eb2cff.json`。

## 5. 自动化验证

最终验证命令：

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify:production
```

最终结果：lint、typecheck、build、production verification 均通过；单元测试 12 文件/76 用例通过，集成测试 11 文件/68 用例通过，E2E 131/131 通过。排查期间发现空库 E2E 未导入新活动 profile，导致发布检查返回 `WATERMARK_PROFILE_REQUIRED`；现由全局初始化复用正式种子逻辑，并由 fake reset 恢复种子候选。种子回归还验证后续部署不会覆盖管理员已经切换的活动/草稿配置。Windows 偶发占用既有截图文件则在共享截图 helper 中对 `EBUSY`、`EPERM`、`UNKNOWN` 做最多三次短重试；E2E 构建和输出移至独立 `.cache` 目录，避免遗留服务锁住生产 `.output`。

## 6. 未完成项

- Kimi 依据 `GATE07-UI-HANDOFF.md` 实现 `/admin/site/branding`，并移除作品编辑器中的 v1 四角控件。
- 补齐 390×844、768×1024、1440×900 的真实 OSS 预览、应用和错误恢复证据。
- 工程复核与用户确认后才能勾选 GATE-07；此前 T19/T20 保持阻断。
