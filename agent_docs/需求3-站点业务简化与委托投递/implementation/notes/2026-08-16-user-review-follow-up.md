# 2026-08-16 用户复核修正执行记录

> 2026-08-17 后续用户复核已纠正本文的 adopted 首页过滤结论：adopted 只从首页“设定领养”排除，仍可进入“精选作品”。以后续 `2026-08-17-home-catalog-ui-fix.md` 为准。

## 1. 边界与结论

- 工作分支：`codex/r3-phase-d-e-t22-t36`，基线及最新 `origin/main` 均为 `206b66a`；未修改、合并或推送 `main`。
- 本轮只使用临时 SQLite、合成图片和 E2E 内存对象存储；未连接生产数据库、OSS、ESA 或真实用户数据。
- T22～T36、GATE-D、GATE-E 的既有完成结论未被重做或代签；本记录只覆盖用户在同一分支追加的复核修正。
- OSS CORS 契约仍为 `AllowedOrigin=*`；应用 API 的 Origin、token、TTL、限流、蜜罐、摘要、MIME 和尺寸边界未放宽。

## 2. 实现与提交

| 提交 | 范围 |
| --- | --- |
| `d8cdc13` | `0042_r3_e_commission_follow_up.sql`、species、pending 手机号唯一性、旧库列表兼容与受控默认联系方式 |
| `7a06402` | 委托单图拖拽/点击卡片、必填物种、重复 pending 409 保留表单、管理列表/详情/保存反馈 |
| `afb289f` | 大图管理“选择 → 上传 → 预览”、默认认证 `w=640` 缩略图、无原图/blob、发布进度与测试处理指令证据 |
| `fe6e70d` | 当时实现首页“自设委托”/“设定领养”、申请直达按钮并把 adopted 同时从两区过滤；该过滤边界已于 2026-08-17 纠正 |
| `fdf58d8` | 旧测试默认联系方式和分区版本断言与新初始化契约同步 |

主要接口/组件：

- `POST /api/public/v1/commission-submissions` 新增 species 并以稳定 409 阻断同手机号 pending 重复提交；accepted/rejected 不阻断。
- `/api/admin/v1/commissions` 在迁移窗口可只读缺少 species 的旧库，避免整个列表 500；新写入仍要求 `0042`。
- 大图管理复用 `/api/admin/v1/media/assets/{id}/preview?w=640`，仅认证、低清、服务端等比缩放；不把本地 blob 或原图放进预览区。
- `ImageDropzoneCard.vue` 只服务委托单图交互，上传仍复用既有 commission session/submission、私有媒体、安全与 cleanup 服务，没有平行媒体体系。
- 首页数据投影在 repository 和 fake repository 两侧都排除 adopted；`/adoptions` 仍保留 adopted 记录。

## 3. 迁移与停止点

`0042_r3_e_commission_follow_up.sql`：

1. 为旧记录增加可为 NULL 的 species；新 API 必须提供 1–50 字 species，真实旧值不猜测。
2. 建立 pending 手机号部分唯一索引；既有库如存在重复 pending，迁移失败停止，不自动接受、拒绝或合并。
3. 仅把空值或仓库历史默认联系方式更新为用户确认的正式默认值；管理员维护的其它值保持不变。

生产仍按 `0039` → `0040` → `0041` → `0042` 串行执行；本轮没有执行任何生产迁移。

## 4. 精确验证结果

| 命令 | 结果 |
| --- | --- |
| `$env:APP_ENV='test'; pnpm lint` | PASS |
| `$env:APP_ENV='test'; pnpm typecheck` | PASS |
| `$env:APP_ENV='test'; pnpm test` | PASS，38 files / 186 tests |
| `$env:APP_ENV='test'; pnpm test:integration` | PASS，29 files / 199 tests |
| `$env:APP_ENV='production'; pnpm build` | PASS，Nuxt/Nitro production build；随构建 content guard PASS |
| `pnpm run verify:production` | PASS，health、public SSR、admin CSR |
| `node scripts/guard-production-content.mjs .output` | PASS |
| `$env:APP_ENV='test'; pnpm exec playwright test tests/e2e/admin-home.spec.ts tests/e2e/r3-stage-e.spec.ts tests/e2e/public-home.spec.ts tests/e2e/t51-brand-filing.spec.ts` | PASS，38/38，单 worker Chromium |

focused 证据：commission follow-up/upload/API 为 3 files / 10 tests；adoption projection 为 3/3；默认联系方式旧断言修正后相关 integration 为 3 files / 34 tests；大图单图完整链路为 1/1。全量 integration 首轮暴露 5 个历史默认值/版本断言漂移，更新为新契约后 focused 与全量均通过；未删除断言或放宽安全契约。

相关 Chromium 覆盖：

- 大图选择、显式上传、上传后/既有项默认低清预览、`w=640` 处理指令、无 `original=1`/blob、发布进度、停用/删除与 390/1024/1440 无溢出。
- 委托必填物种、单图预览、成功、同手机号 pending 409、私有 no-store 管理预览、列表白底“昵称 · 物种”、保存反馈与管理 409。
- 首页新标题/CTA、当时的 adopted 双区排除、空领养隐藏、Logo/字体、三视口 ICP/公安备案顺序及公安图标在编号前；adopted 双区排除已由 2026-08-17 后续记录纠正。

## 5. 未代签与 handoff

- 景宸仍需在生产只读清单逐条判断 T26 的歧义领养状态和真实图片，补录/下架并让 `0039` 三项门禁归零。
- `0042` 前还需对生产重复 pending 手机号做脱敏计数；非零项由工作室人工决定状态，不能由 Agent 猜测。
- 真实手机动态地址栏、输入法、图片方向和单图提交仍待用户验收；本地 Chromium 不替代真实设备。
- 独立 Review、最新 SHA CI、用户验收、生产备份/迁移/部署、真实 OSS/ESA 校验均未执行或代签。
- 指定 Logo/字体和公安备案图标已进入仓库；正式站最终视觉与链接仍随用户验收确认。
