# agent_docs

本目录是项目的 spec-driven 工作区。每个需求目录维护自己的产品边界、规格、计划、任务与状态；增量需求只覆盖其明确改变的行为，不复制或放宽既有安全、媒体、隐私和部署基线。

## 当前需求

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：当前已落地产品、生产与部署基线；阶段与上线门禁以其 [`STATE.md`](./需求1-兽装工作室主页/STATE.md) 和 [`implementation/TASKS.md`](./需求1-兽装工作室主页/implementation/TASKS.md) 为准。
- [`需求2-站点导航与内容增强/`](./需求2-站点导航与内容增强/)：当前增量开发；`GATE-01` 决策门禁已关闭，T01 已完成分支工程实现与该 SHA 自动化；T02～T15 待实施（T10-A 已取消），T16/T17 为待执行的独立 Review 与用户验收，状态以其 [`STATE.md`](./需求2-站点导航与内容增强/STATE.md) 和 [`implementation/TASKS.md`](./需求2-站点导航与内容增强/implementation/TASKS.md) 为准。

需求2继承需求1的图片优先、双 Host、私有媒体、隐私、部署和验收边界。发生冲突时，需求2只覆盖已写入其 SPEC/PLAN/TASKS 的新增产品行为；其余仍以需求1为准。

## 权威顺序

每个需求目录内按以下顺序读取：

1. `foundation/README.md`：产品边界；
2. `requirements/SPEC.md` 与适用的媒体政策：业务和媒体契约；
3. `planning/PLAN.md`：技术路线与实施顺序；
4. `.design/`：公开端与管理端体验；
5. `implementation/TASKS.md`：该需求唯一任务和勾选权威；
6. `STATE.md`：当前阶段、阻断项和下一步。

`models/README.md` 是实施投影；`materials/`、历史原型、dated notes、旧 Review 和截图只能说明当时事实。需求1的 `planning/FUTURE-ITERATIONS.md` 不是实施授权。

## 当前分支事实（2026-08-12）

- 分支：`feat/requirement-2`，相对 `origin/main` 实施需求2的 T01；
- T01 代码提交：`e573760`；E2E 修复提交：`a38c295`；
- T01 最新的实现代码 SHA 为 `a38c295`；其后的本轮提交只同步文档，不改变应用代码或测试；
- PR：[#10](https://github.com/WangMinan/project-fur-forge/pull/10)，当前仍为 open，尚未合入 `main`；
- `a38c295` 的 GitHub Actions run [`31515689322`](https://github.com/WangMinan/project-fur-forge/actions/runs/31515689322) 已取得 `checks`、`image-build`、`e2e` 全部成功；该结果只绑定该实现 SHA，当前 PR HEAD 及检查状态须从远端重新查询；
- 上述自动化只证明该 SHA 的工程门禁，不代签需求2的 T16 独立 Review、T17 用户验收，也不改变需求1的 T50/GATE-E/T53 上线门禁。

后续文档提交或代码提交形成新 SHA 后，必须重新查询该 SHA 的远端检查，不能沿用 `a38c295` 的结果。

## 执行纪律

- 所有代码、文档、Review 和修复通过独立分支与 PR 合入 `main`，禁止直接在 `main` 提交或推送；
- 后端 → 前端 → 新上下文独立 Review → 用户验收；同一实现者不得为自己代签 Review；
- 不删除或清空 `.env`，不重写已执行迁移，不把 Secret 写入仓库、日志或截图；
- 只运行与改动风险相称的测试；自动化不能替代真实浏览器验收；
- 不把功能工程完成、PR CI、独立 Review、用户验收、代码冻结或正式发布互相代签。
