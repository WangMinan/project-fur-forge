# 阶段 D/E（T22～T36）执行记录 · 2026-08-16

## 1. 边界与基线

- 开工基线：`origin/main` `206b66aa2b5e260a99053f9a3450051096d19f57`。
- 任务分支：`codex/r3-phase-d-e-t22-t36`；未修改或合并 `main`。
- 只使用临时 SQLite、合成图片和本地假对象存储；未连接生产数据库、OSS、ESA 或真实用户数据。
- 用户本轮确认阶段 B/C 已完成，本次只做状态漂移校准，未重做 B/C，也未补签真实设备、独立 Review 或验收证据。
- 写入、迁移、publication/cleanup/operation 全部串行执行；未进入阶段 F、生产部署或生产迁移。

## 2. 提交边界

| 提交 | 内容 |
| --- | --- |
| `db89c31` | 引入公安备案图标与配置，在 ICP 右侧展示“左图标、右编号”，同步三视口 E2E |
| `79a32d4` | T22～T29 作品/领养目标模型、公开与管理 UI、adoption cover、`0039` contract 及 GATE-D 测试 |
| `c769c84` | T30/T31 匿名上传 cancel/retry/cleanup、提交事务、限流与安全契约 |
| `ebee817` | T32～T34 公开申请页、管理列表/详情/状态与私有图片访问 |
| `4a39704` | T35 FAQ UI/API/Schema 退役与 `0040` contract；保留 `commission_email_action`/`contact_qq` |
| `f411620` | T36 本地真实 Chrome 单图端到端与 PII/409/私有媒体断言 |
| `c39e93c` | 新增 `0041`，前向修复 0039 重建 works 后 Hero 兼容表外键 |
| `c45233e` | 为详情图集按真实尺寸预留布局，消除媒体 decode 前 CLS |
| `fd0af06` | 将全站浏览器回归断言同步为需求3目标 contract |

## 3. 数据库与迁移

### `0039_r3_d_works_contract.sql`

- DROP/重建前检查三项前置条件：歧义领养状态、published adoption 缺 READY 独立 cover、published work 缺 READY 主出厂照；任一非零立即以稳定错误停止。
- 只在门禁归零后重建 `works`/`work_assets`，删除 suit/owner/contact/tags/旧 progress/method/event 等旧字段及 `work_feature_tags`。
- 不猜测状态、不从其它图片生成 adoption cover。
- fresh、既有合成库、三种阻断、成功、重入、FK、integrity 均通过；未对生产库执行。

### `0040_r3_e_commission_contract.sql`

- 前向重建 `site_content`，删除 `commission_faq_json`/`commission_faq_version`。
- 显式复制并保留 `commission_email_action`、`contact_qq`、邮箱与 QQ/QQ群目标结构。

### `0041_r3_d_hero_work_fk.sql`

- 全量 E2E 发现 SQLite 在 0039 重建 `works` 时把兼容 Hero 表的 `linked_work_id` 外键重定向到已删除的旧表。
- 以前向迁移重建 Hero 兼容表，恢复 `works(id) ON DELETE SET NULL`、索引、READY trigger 与保护 trigger；不改写 0039。

生产执行顺序固定为 `0039` → `0040` → `0041`，必须串行。三项数据门禁、FK、integrity 或 readiness 任一失败即停止。

## 4. 阶段 D：作品与领养

- 管理表单与 shared Schema 只读写目标字段；公开 `PublicWork` 摘要/详情删除旧业务字段和筛选。
- `/works` 保留名称搜索、分页和发布时间排序；`/works/{slug}` 只显示名称、物种、图集、前后/相关作品，并收缩 SEO/JSON-LD。
- adoption cover 复用现有私有源图、publication、watermark variant、lease、recovery、purge 与管理预览，不新建媒体体系。
- `/adoptions` 卡片只使用独立 cover，展示名称、物种、状态和可选价格；`design_sheet` 维持 0..1，可进详情但不作卡片或发布门禁。
- 三视口覆盖 390×844、768×1024、1440×900；全站回归另覆盖既有 1023/1024 边界。
- T26 的复核清单、人工补录、下架和 contract 阻断能力完成；真实领养状态/图片判断留给景宸，详见第 8 节。

## 5. 阶段 E：委托投递

### API 与安全

- 公开上传：`POST /api/public/v1/commission-upload-sessions`、`complete`、`cancel`、`retry`；一张不超过 20 MB 的合成图片，使用独立大写状态机、token、≤10 分钟 TTL、条件 PUT、摘要、MIME、尺寸、应用 API Origin、限流与蜜罐。
- 提交：`POST /api/public/v1/commission-submissions`；校验称呼、+86 手机、QQ、身高、体重及 COMPLETED upload，在单事务中消费 asset 并创建 pending，处理重复消费与 receipt collision。
- 清理：`pnpm commission:cleanup-expired-uploads` 复用私有媒体清理基础设施，覆盖过期、失败、取消和未消费对象。
- 管理：`GET /api/admin/v1/commissions`、`GET/PUT /api/admin/v1/commissions/{id}`、认证 `no-store` 设定图详情；version 冲突返回 409 并要求真实确认/重载。
- 委托设定图只保留 PRIVATE 资产：无 PUBLIC variant、无 ESA 公网地址、无水印。
- OSS CORS 继续 `AllowedOrigin=*`；没有新增精确 Origin 任务或门禁，应用自己的 Origin/token/TTL/限流/蜜罐/摘要/MIME/尺寸校验保持生效。

### 公开端与管理端

- `/commission/apply` 提供可见标签、单图预览/上传、邻近错误、仅内存草稿、过期重选、提交状态与成功回执；不把表单内容写入 URL、localStorage、analytics 或 console。
- `/admin/commissions` 提供 pending/accepted/rejected 列表、认证私有详情、备注、状态与 409 对话框。
- `/commission` 主行动切到站内申请，邮箱作为备用；`/about` 与联系面只维护邮箱、QQ、QQ群。
- FAQ Card/API/Schema/DTO/test 已删除；`commission_email_action` 未删除。

## 6. 公安备案重同步

- 从用户提供的本地图标导入 `public/filings/police-filing.png`，未引入原始目录或额外文件。
- 环境模板配置公安备案编号和查询 URL；Footer 在 ICP 右侧渲染公安备案链接，链接内部先显示图标、右侧显示编号；移动端允许整组换行但保持图标/编号同行。
- E2E 校验图标可见、资源路径、链接、`target="_blank"`、`rel="noreferrer"`、DOM 顺序和三视口布局。

## 7. 精确验证记录

| 命令 | 结果 |
| --- | --- |
| `$env:APP_ENV='test'; pnpm lint` | PASS |
| `$env:APP_ENV='test'; pnpm typecheck` | PASS |
| `$env:APP_ENV='test'; pnpm test` | PASS，38 files / 186 tests，85.36s |
| `$env:APP_ENV='test'; pnpm test:integration` | PASS，28 files / 196 tests，122.75s |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/r3-commission-contract.test.ts tests/integration/r3-works-contract.test.ts` | PASS，2 files / 6 tests |
| `pnpm exec playwright test tests/e2e/r3-stage-d.spec.ts tests/e2e/t51-brand-filing.spec.ts` | PASS，5 tests |
| `pnpm exec playwright test tests/e2e/t26-t27-visual-follow-up.spec.ts` | PASS，3 tests |
| `$env:APP_ENV='production'; pnpm build` | PASS，Nuxt 4.5.1 / Nitro node-server；构建脚本内 content guard 通过 |
| `pnpm run verify:production` | PASS，health、public SSR、admin CSR |
| `node scripts/guard-production-content.mjs .output` | PASS，无输出，exit 0 |
| 隔离设置 `E2E_RUN_DIRECTORY`/随机 `E2E_PORT`/`E2E_SKIP_BUILD=1` 后执行 `pnpm test:e2e` | PASS，235/235，6.0m |

最终全量 E2E 包含：Contract 前置阻断/fresh/既有库/重入/FK/integrity 的 integration 证据；DTO 旧字段消失；作品/详情/领养三视口；三类媒体 publication/失败恢复/清理；匿名上传和提交成功/错误/过期/重复/限流/蜜罐/cleanup/API Origin；PII 负向边界；管理 409；以及本地真实 Chrome 单图上传、提交、私有查看流程。

## 8. 真实数据 handoff 与未代签项

景宸必须在生产迁移前使用后台复核清单逐条检查真实领养记录和真实图片：

1. 对每条歧义/NULL 状态明确选择 `available` 或 `adopted`，不得由脚本默认；
2. 对 published adoption 上传真实横版单头 `adoption_cover`，不能从 studio photo/design sheet 自动生成；无法补齐则先下架；
3. 为所有 published work 确认一张 READY 主 `studio_photo`；缺失则补录或先下架；
4. 重新读取三项脱敏计数，全部为 0 才允许执行 0039，任何失败保持停止。

本记录未代签：真实生产数据判断、真实手机动态地址栏/输入法/方向/上传提交、独立 Review、远端 CI、用户验收、生产迁移、生产部署、OSS/ESA 真实对象或缓存操作。执行记录不包含 Secret、PII、真实图片、fixture 表单值或完整 Object Key。
