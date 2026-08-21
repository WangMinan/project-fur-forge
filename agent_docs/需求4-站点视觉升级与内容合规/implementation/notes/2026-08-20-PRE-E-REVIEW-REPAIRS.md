# 阶段 E 前独立 Review 修复清单

> **基线**：`codex/r4-t04-t21-foundation@3f12122e227d0a27ae7aa80c7fbd3d6d4de7577d`；`origin/main@cbaf98fec4868e94af5b28faf5c3d9a23344d859`。
> **来源**：GPT-5.6 Pro 对 PR #21 `d66e2c3` 的独立 Review；本清单已在当前 HEAD 重新核验，不直接把旧 finding 当作当前事实。
> **停止点**：只收口 T04～T34 与 Gate C/D 的遗留问题，不进入 T37 动效 token、Hero 焦点或首页四幕。

## 1. 问题清单

| 编号 | 阶段 E 前处理 | 当前证据 | 修复决定 |
| --- | --- | --- | --- |
| PE-01 | 必须 | 申请上传、提交、readiness 和申请页都没有统一隐私政策就绪校验 | 建立一个共享纯校验；生产 readiness/preflight、上传会话创建、submission 创建和申请页共同使用 |
| PE-02 | 必须 | notices 由当前安装平台生成，却称为应用 runtime closure；`check:fast` 会在不同平台产生 drift | 明确为生成环境安装快照；平台相关 drift 移到显式 release 检查；Linux runtime closure 仍由 T35/T36 完成 |
| PE-03 | 必须 | `SEE LICENSE IN ...` 未被视为未知许可证 | 扩展拒绝规则并增加一个稳定单元测试 |
| PE-04 | 必须 | 两项确认的关键不变量只在两个 legacy 大文件内 | 新增小型 core integration，只证明缺失/false 不消费 upload，以及 true 保持成功事务 |
| PE-05 | 必须 | 申请页提交按钮仍是局部原生按钮和重复胶囊 CSS | 改用既有 `PublicAction`，不改表单业务状态机 |
| PE-06 | 必须 | 删除执行 busy 时 Escape/遮罩仍可关闭确认框 | `AdminConfirmDialog` 在 busy 时拒绝所有 dismiss，并在既有 smoke 中验证 |
| PE-07 | 必须 | `/licenses` 静态导入并 SSR 渲染 798 条依赖 | 生成紧凑 summary；页面只显示 FFmpeg、字体、许可证统计和完整 TXT 下载 |
| PE-08 | 必须 | 删除审计文档要求持久计数/失败码，当前 `audit_logs` 只保存摘要、结果、时间和 actor | 按小型工作室现有需要收缩文档模型；计数保留在单次 dry-run/execute 结果，不新增审计平台或迁移 |
| PE-09 | 必须 | `TASKS.md` 顶部仍写“从 T22 继续”，PR 标题/正文仍只代表 T04～T21 | 修正文档状态；代码与验证推送后再更新 PR 元数据 |

## 2. 跨文档边界矩阵

| 主题 | SPEC/COPY 契约 | models/data migration | TASKS/STATE | 本轮边界 |
| --- | --- | --- | --- | --- |
| 隐私政策 | 必须描述真实收集、处理者和联系邮箱 | 不新增处理者字段；前向迁移保留管理员自定义文本 | Gate C 已有实现证据 | 增加 fail-closed readiness，不覆盖管理员文本 |
| 第三方声明 | npm 与实际分发事实分层；FFmpeg 按公开镜像分发处理 | npm 生成物与 Linux runtime registry 分开 | T35/T36 未完成 | 修正本地生成口径和 drift 路径，不伪造 Linux 镜像事实 |
| 委托确认 | 两个 literal true，消费 upload 前校验 | 不持久化确认 | T24/T25 已完成 | 只把稳定不变量提升到 core |
| 删除审计 | 单条 dry-run/execute、脱敏、可重入 | 不建通用 operation/audit 平台 | T29～T33 已完成 | 文档收缩到现有最小审计，不新增 Schema |
| 公开视觉 | 新行动使用统一组件；图片优先 | 无数据变化 | T37 起尚未开始 | 只替换申请提交行动和 licenses 载荷，不进入首页四幕 |

## 3. 证据索引

- 隐私当前链路：`server/utils/service/readiness.ts`、`server/utils/service/commission-management.ts`、`app/pages/commission/apply.vue`、`scripts/oss-preflight.mjs`。
- notices 当前链路：`scripts/third-party-notices.mjs`、`app/pages/licenses.vue`、`package.json`、`tests/unit/third-party-notices.test.ts`。
- confirmation 分类：`tests/test-groups.ts`、`tests/integration/commission-upload-api.test.ts`、`tests/integration/r3-commission-upload.test.ts`。
- 删除与对话框：`server/utils/service/commission-retention.ts`、`app/components/admin/AdminConfirmDialog.vue`、`tests/smoke/main-journeys.spec.ts`。
- 文档事实：`requirements/SPEC.md`、`models/README.md`、`planning/DATA-MIGRATION.md`、`implementation/TASKS.md`、`STATE.md`。

## 4. 明确不做

- 不提前完成 T35/T36 的 Linux FFmpeg runtime registry、容器嵌入、Docker Hub 分发核验或 release evidence。
- 不进入 T37～T47 的动效、Hero 焦点和首页四幕。
- 不为删除审计增加新表、通用事件详情 JSON 或失败状态机。
- 不因单管理员场景重做删除并发模型。
- 不运行生产迁移、真实 OSS 删除、镜像发布或远端部署。

## 5. 实施结果

- PE-01：新增唯一 `privacyPolicyReadiness`，已接入申请页、上传会话创建、submission 创建、health readiness 和 production live preflight。Nuxt dev 首次验证发现共享 `.mjs` 被错误外部化到 `D:\shared`，已加入现有 `nitro.externals.inline` 并补部署契约检查。
- PE-02/03/07：notices 改为生成环境安装快照；`SEE LICENSE IN ...` 阻断；drift 移入 release；新增 1,995 字节 summary，436,715 字节完整 JSON 在 production bundle 中零命中，完整 TXT 继续下载。
- PE-04：新增 `commission-confirmation.test.ts`，只保护缺失/false 不消费与 true 成功事务，同时覆盖政策失效后不消费 upload。
- PE-05/06：申请提交复用 `PublicAction`；删除执行 busy 时 Escape、遮罩和取消按钮均不能关闭对话框。
- PE-08/09：删除审计文档收缩到现有最小模型；TASKS 状态与本轮 Review/验证证据同步。PR 元数据在修复提交推送后更新。

## 6. 验证结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- privacy/notices unit：2 文件、4 项通过。
- confirmation/readiness integration：2 文件、13 项通过。
- `pnpm check:fast`：52 文件、327 项通过。
- `pnpm test:smoke`：9/9 通过；覆盖申请成功/重复手机号、删除 busy dismiss、licenses 三视口可读。
- `pnpm test:release`：通过；包含 notices drift、smoke、production build/guard、production verify、ESA/observability 和 586 tracked files Secret scan。
- 未运行：真实生产 preflight/迁移/OSS 删除、镜像构建/发布、真实手机和王旻安/景宸人工视觉验收。
