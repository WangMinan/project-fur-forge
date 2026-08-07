# agent_docs

本目录是项目的 spec-driven 工作区。当前唯一活动需求为 [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)。

## 权威顺序

1. `foundation/README.md`：产品边界与不可违背的原则；
2. `foundation/WATERMARK-CENTERED-V2.md`：2026-08-01 居中可配置水印地基增量；仅在水印条款冲突时覆盖上一文件；
3. `requirements/SPEC.md` 与 `requirements/MEDIA-PUBLICATION-POLICY.md`：业务需求、数据边界与媒体公开规则；
4. `planning/PLAN.md`：当前技术路线、阶段范围和实施顺序；
5. `.design/`：公开站、管理端及水印体验与视觉契约；
6. `implementation/TASKS.md`：唯一可勾选任务清单；
7. `STATE.md`：当前状态、阻断项和下一步入口。

`models/README.md` 与水印增量文档是上游规格/计划的实施投影，不构成额外权威层级。`materials/`、`planning/prototype-v1/` 与 `implementation/notes/` 是素材、证据或历史记录，不得覆盖当前契约。

## 执行责任路由

当前模型分工、`main` 串行交接和独立门禁见
[`需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`](./需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md)。

默认分工为：

- GPT-5.6 Sol 担任 `BACKEND_PRIMARY`，并可在新的独立上下文中担任 `REVIEW`；
- `FRONTEND_PRIMARY` 由用户按任务在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中选择；
- 联合任务按后端 → 前端 → Review → 用户验收串行提交；
- 同一实现者不得为自己的实现代签独立 Review。

## 当前状态

截至 2026-08-07，阶段 C 与阶段 C.1 已经完成，`GATE-C1` 已通过。用户已在浏览器中完成人工核对，确认公开端、管理端和阶段 C 主业务行为符合当前验收预期。

项目现处于 **阶段 D · P1 一期增强范围确认**。当前唯一明确的优先级是返图墙垂直切片：

- T35：返图模型与可选授权记录；
- T36：返图上传、轻量水印、管理与公开墙。

T37–T41 尚未自动授权。尤其是受限文字扩展、slug 改址历史和 30 天回收站，需由用户确认实际价值后决定保留、裁剪或取消。

阶段迁移记录见
[`需求1-兽装工作室主页/implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md`](./需求1-兽装工作室主页/implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md)。

## 当前 CI 与发布边界

阶段 C 完成不等于正式发布就绪。记录迁移时，代码基线
`3984b4f181d5a3071a119affae34c1088a53b6f9` 的 GitHub Actions 状态为：

- `image-build` 成功；
- `checks` 在 Production build 失败；
- `e2e` 因依赖失败而跳过。

该故障已移动到阶段 E 的 T49，不阻断阶段 D。T49 必须以届时最新 `main` 修复并取得 `checks`、`image-build`、`e2e` 同一 SHA 全绿。

正式域名、TLS、线上 Compose、备份、监控、升级、回滚和恢复演练由 T52 处理。在 T49、T50、T52 完成前，不得声称流水线已全绿或站点已经正式上线就绪。

## 当前产品与技术主线

当前技术主线仍为单 Nuxt 4 全栈应用、Node.js 24、Nitro、SQLite/Drizzle、单镜像/单进程和两个 OSS Bucket：

- `project-furry-forge-private`：永久原图、私有处理源、品牌候选、草稿和受控预览；
- `project-furry-forge-public`：只保存已经发布并验证的网页衍生图。

当前活动作品水印为 `brand-centered-v2`，默认 50% 不透明度、60% 缩放；旧 `brand-standard-v1` 只保留为历史身份。站点展示位继续无水印，作品展示位继续使用活动水印。

所有长耗时操作必须展示基于真实服务端状态、可恢复的任务进度；E2E 必须验证有意义的用户路径和实际页面结果，不能以用例数量、状态码或元素数量自证页面质量。

当前范围不建设站内交易、支付、订单、多管理员、万能 CMS、公开投稿、社交互动、消息队列或自动媒体 worker。
