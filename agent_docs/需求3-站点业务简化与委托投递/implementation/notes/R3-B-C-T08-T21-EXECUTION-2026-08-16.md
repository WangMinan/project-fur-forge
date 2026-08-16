# 需求3阶段 B/C：T08～T21 执行记录（2026-08-16）

## 范围、基线与停止点

- 用户确认 GATE-A 已发布完成后，严格按阶段 B → GATE-B → 稳定提交 → 阶段 C → GATE-C 推进。
- 基线：`origin/main@979b7db59c6014a48dd918bedcfa05803986420c`。
- 分支：`codex/r3-phase-b-c-t08-t21`；未直接修改或合并 main。
- 只执行 T08～T21；阶段 D、E、F 未开展。
- OSS Bucket CORS 保持现网 `AllowedOrigin=*`，不是失败门禁；匿名 API 仍独立执行 Origin、token、TTL、限流、蜜罐和请求体校验。
- 所有测试只使用合成图片、临时数据库与测试对象存储；本文不记录 Secret、PII、真实用户图片或完整对象 Key。

## 依赖顺序与提交边界

| 范围 | 任务 | 提交 |
| --- | --- | --- |
| Hero Expand 与幂等拆分 | T08～T09 | `ca32764cc4e9157f4bf0bdb7fa95b21014e5b51e` |
| works/adoption/commission Expand | T10～T12 | `5093c63f854090d38c8761efb092d6e90dc84f89` |
| 匿名委托上传安全 | T13 | `3345d652d21e89be29007ef93384f9679ee2208a` |
| adoption Expand API | T10～T11 | `23e2f23528ef6fc53c6f05301e177c16ba455256` |
| migration 兼容修复与 GATE-B 稳定点 | T09、T14 | `fba8353407bd91fc54b02437c50317bf2afac674` |
| 公开 Hero、导航、页面切换与首页收尾 | T15～T19、T21 | `9e710cb05633f85f532d8406d4f567a391010f77` |
| Hero collection publication/lease/recovery/purge | T20 | `ff67452a08294dbc8abc31b6660ea0c4b0ce527e` |
| 四集合管理端 | T20 | `36d711821ac7fd5ebb47a0d4691a48a22086e592` |

文档同步提交在本记录完成后单独形成，避免把实现压成一个巨型提交。

## 阶段 B：T08～T14

### 迁移与模型

- 新增前向 migration `0037_r3_b_hero_expand.sql`：建立首页/委托 × 横/竖四个 `site_hero_collections` 版本域和独立 `site_hero_items`；旧 pair 按 placement、方向、alt、启停和确定性顺序拆分，重复 migration 不重复插入。
- 新增前向 migration `0038_r3_b_adoption_commission_expand.sql`：加入 nullable adoption status、独立 adoption cover/public card 身份，以及 `commission_upload_sessions`、`commission_submissions` 和私有设定图角色；未重写历史 migration。
- adoption 只自动映射 `available → available`、`delivered → adopted`；其它旧状态保持 NULL，并由后台复核清单暴露。
- commission 设定图保持 PRIVATE，无 PUBLIC variant、ESA URL 或水印；预览只在认证管理 API 返回并使用 `no-store`。

### API 与安全边界

- 管理 API：`PUT /api/admin/v1/works/{id}/adoption-cover`、`GET /api/admin/v1/works/adoption-status-review`、`GET /api/admin/v1/commissions/{id}/design-reference`。
- 匿名上传 API：`POST /api/public/v1/commission-upload-sessions`、`POST /api/public/v1/commission-upload-sessions/{id}/complete`。
- 匿名会话使用独立大写状态机、短时条件 PUT、不可预测 token/对象身份、一次性 complete、摘要与图片尺寸校验、独立限流和蜜罐；错误、普通日志、URL、analytics 与 fixture 不写入 PII。
- GATE-B 已验证：四集合 version/owner 独立、拆分幂等、cover identity、commission 私有性、签名 PUT、应用层 Origin/token/TTL/限流负例、旧公开页面和歧义 adoption 清单。

## 阶段 C：T15～T21

### 公开端

- `PublicHeader.vue` 为桌面导航增加圆角胶囊、阴影、轻微上移和等价 focus；移动抽屉继续使用既有无障碍能力。
- `layouts/default.vue` 只切换 `main` 内 route node；Header/Footer 保持稳定，离场禁用 pointer events，路由前进/后退归还 main 焦点，锚点和错误页可恢复，reduced-motion 关闭位移。
- `HomeMotionReveal` 与三类可点击卡保持 SSR/无 JS 默认可见，只在首次入屏揭示；hover 与 reduced-motion 均有浏览器断言。
- `HomeHeroCarousel.vue` 删除 action/linked work，桌面中文标题居中且英文/slogan 同排左右，移动整体左对齐下移，覆盖 `100svh`/`100dvh`。
- 公开 DTO 直接提供独立 `landscape`/`portrait` 数组；SSR 只直出两方向首项组成的 picture，水合后按真实 orientation 分别维护索引。后续项懒加载，固定 10 秒轮播，可显式暂停，hidden/reduced-motion 停止。
- 委托页也只消费独立横竖首项；方向变化时同步媒体替代文字。
- 首页标题固定为“委托与领养”，首页和两端导航无 latest updates 请求/入口。

### 管理端与 publication

- 新增 Hero collection 管理 API：集合读取、item 创建/更新/删除、完整启用顺序 PUT、enable/disable、private preview、upscale、operation retry，共 11 条路由。
- publication 复用现有 `publication_operations`、operation lease/recovery、site-display recipe、公开对象删除和 ESA 精确 purge；首页入口使用的委托横版派生图与 Hero 派生图在下架时由同一 cleanup manifest 删除。
- 四个标签页分别维护首页横版、首页竖版、委托横版、委托竖版。每次写只提交当前 collection expectedVersion；完整顺序冲突稳定返回 409，列表顺序变化使用 FLIP，reduced-motion 禁用动画。
- 单项管理链路覆盖：上传 → 保存 → 私有预览 → 必要时确认私有放大源 → 发布启用 → 排序 → 停用并清理公开派生/缓存 → 删除；每集合最多五个启用项且不能停用最后一个启用项。

## 精确验证结果

阶段 B 稳定点执行并通过：

- `pnpm lint`：通过。
- `$env:APP_ENV='test'; pnpm typecheck`：通过。
- `$env:APP_ENV='test'; pnpm test`：38 files / 193 tests 通过。
- `$env:APP_ENV='test'; pnpm test:integration`：25 files / 186 tests 通过。
- `$env:APP_ENV='production'; pnpm build`：通过 production build 与 content guard。
- `pnpm run verify:production`：通过 health、public SSR、admin CSR。
- `pnpm exec playwright test tests/e2e/public-home.spec.ts`：56 tests 通过。

阶段 C 冻结代码最终回归：

- `pnpm lint`：通过。
- `$env:APP_ENV='test'; pnpm typecheck`：通过。
- `$env:APP_ENV='test'; pnpm test`：38 files / 193 tests 通过。
- `$env:APP_ENV='test'; pnpm test:integration`：26 files / 190 tests 通过。
- `$env:APP_ENV='test'; pnpm exec vitest run --config vitest.integration.config.ts tests/integration/r3-hero-collection-publication.test.ts`：1 file / 4 tests 通过。
- `$env:APP_ENV='production'; pnpm build`：通过 production build 与 content guard，并确认 11 条新管理路由进入 Nitro 产物。
- `pnpm run verify:production`：通过 health、public SSR、admin CSR。
- `pnpm exec playwright test tests/e2e/public-home.spec.ts tests/e2e/admin-home.spec.ts tests/e2e/t09-ui.spec.ts tests/e2e/t26-t27-visual-follow-up.spec.ts`：48 tests 通过，覆盖 390×844、768×1024、1023×900、1024×900、1440×900、SSR/no-JS、图片 decode、CLS、无横向溢出、方向切换、hydration 无错误、导航/页面动效、reduced-motion 与四集合管理全链路。
- 实现者人工查看最终 390×844 与 1024×900 浏览器截图：移动文字组左对齐下移且首屏无白块；桌面中文标题居中，英文/slogan 同排左右，1024 宽度无换行或溢出。

一次命令错误已纠正：首次 focused integration 误用 unit Vitest config，返回 `No test files found`；随后显式指定 `vitest.integration.config.ts`，原测试 4/4 通过。没有通过 skip、删除断言或放宽安全契约处理失败。

## 未代签与后续边界

- T08～T21 均有实现与测试证据；GATE-B 已完成。
- GATE-C 的五档 Playwright 视口、桌面/移动差异、无白块、横竖独立/无 hydration 警告和交互动效已通过；真实手机尚未在当前环境验证，因此 GATE-C 第一组合项和整体门禁保持未完全关闭。
- 实现者不代签独立 Review、远端分支 CI、真实手机验证或用户验收。
- 真实手机需检查动态地址栏下的 100svh/100dvh、portrait/landscape 切换、首屏图片 decode/无白块、轮播暂停/滑动/键盘替代路径与 reduced-motion。
- 阶段 D、E、F 保持未开始；本分支不得自行合并 main。
