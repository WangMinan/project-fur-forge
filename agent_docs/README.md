# agent_docs

本目录是项目的 spec-driven 工作区。当前唯一活动需求为 [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)。

## 权威顺序

1. `foundation/README.md`：产品边界与不可违背原则；
2. `requirements/SPEC.md` 与 `requirements/MEDIA-PUBLICATION-POLICY.md`：业务、数据和媒体公开规则；
3. `planning/PLAN.md`：当前技术路线、范围和实施顺序；
4. `.design/`：公开站和管理端当前体验与视觉契约；
5. `implementation/TASKS.md`：唯一可勾选任务清单；
6. `STATE.md`：当前状态、阻断项和下一步入口。

`models/README.md` 是实施投影，不构成额外权威层级。各目录中的 `WATERMARK-CENTERED-V2.md` 是 GATE-07 归档指针，不再覆盖当前 README、SPEC、媒体策略或 PLAN。

`materials/`、`planning/prototype-v1/` 与 `implementation/notes/` 是素材、调研、原型、证据或历史记录，不得覆盖当前契约。调研中关于返图水印或独立展会实体的早期建议已经被 2026-08-07 的用户决策覆盖。

`planning/FUTURE-ITERATIONS.md` 只记录未来候选，不是实施授权。候选必须被提升到 SPEC、PLAN、TASKS 后才能编码。

## 执行责任路由

模型分工、`main` 串行交接和独立门禁见
[`需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md`](./需求1-兽装工作室主页/implementation/EXECUTION_ROUTING.md)。

默认分工：

- GPT-5.6 Sol 担任 `BACKEND_PRIMARY`，并可在新上下文担任独立 `REVIEW`；
- `FRONTEND_PRIMARY` 由用户在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中逐任务选择；
- 联合任务按后端 → 前端 → Review → 用户验收串行提交；
- 同一实现者不得为自己的实现代签独立 Review。

## 当前状态

截至 2026-08-07：

- 阶段 C 与 C.1 已完成；
- `GATE-C1` 已通过；
- 阶段 D 范围已确认，下一项为 T35；
- GitHub Actions 当前遗留由 T49 处理，不阻断阶段 D；
- 正式域名、TLS、线上 Compose、升级、回滚和恢复演练由 T52 处理。

阶段 D 执行顺序：

1. **T35**：一图一记录的返图模型、作品关联、版本、状态和可选私有授权记录；
2. **T36**：`return_photo` 私有上传、无水印 `return-display-v1`、返图管理和一级 `/returns` 原比例瀑布流；
3. **T37**：复用 `purpose=adoption` / `adoption_method=event_drop` 的轻量展会掉落；
4. **T42**：只对 T35–T37 做阶段门禁和用户验收。

范围裁剪：

- T38 取消，不扩张更多站点文字内容；
- T39 当前版本取消，未来与分享、OG、海报、二维码和长期 URL 一并讨论；
- T40 取消，不建设 30 天回收站；
- T41 不再单列，手机轻量能力并入 T36、T37。

阶段 D 决策见
[`需求1-兽装工作室主页/implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md`](./需求1-兽装工作室主页/implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md)。

## 当前产品与技术主线

技术主线仍为单 Nuxt 4 全栈应用、Node.js 24、Nitro、SQLite/Drizzle、单镜像/单进程和两个 OSS Bucket：

- `project-furry-forge-private`：永久作品原图、永久返图原图、私有处理源、品牌候选、草稿和受控预览；
- `project-furry-forge-public`：只保存已经发布并验证的网页衍生图。

媒体保护：

- 标准作品、常规领养和展会掉落使用活动 `brand-centered-v2`；
- 首页/委托 Hero 和首页业务入口使用无水印 `site-display-v1`；
- 阶段 D 返图使用无水印 `return-display-v1`；
- 私有原图、授权记录、联系人和敏感 EXIF 不进入公开响应。

所有长任务展示基于服务端状态、可恢复的进度；E2E 验证实际用户路径和页面结果，不能以用例数量、状态码或元素存在自证质量。

当前范围不建设交易、支付、订单、多管理员、万能 CMS、公开投稿、社交互动、独立展会平台、通用回收站、消息队列或自动媒体 worker。

## 当前 CI 与发布边界

阶段 C 完成不等于正式发布就绪。已知基线：

- `image-build` 成功；
- `checks` 在 Production build 失败；
- `e2e` 因依赖失败跳过。

T49 必须以届时最新 `main` 复现并取得 `checks`、`image-build`、`e2e` 同一 SHA 全绿。T52 完成正式域名、TLS、线上 Compose、备份、监控、升级、回滚和恢复演练。

在 T49、T50、T52、T53 完成前，不得声称流水线已全绿或站点正式上线就绪。