# agent_docs

本目录是 spec-driven 开发的工作区，流程对齐 `D:\code\spec.template`（[github/spec-kit](https://github.com/github/spec-kit)）。

## 开新需求

```bash
cp -r agent_docs/_template/ agent_docs/需求N-<短描述>/
```

复制后，让 agent 先读该需求文件夹下的 `STATE.md` 与 `foundation/README.md`，按 [`D:\code\spec.template\AGENTS.md`](../../spec.template/AGENTS.md) 推进七阶段直到闭环。

## 目录约定

- `_template/` —— 可复制的需求骨架（**不要直接在里面写需求**，复制出去再写）。
- `需求N-<描述>/` —— 每个需求一个文件夹，内含 `STATE.md`（状态机）与 `foundation/ requirements/ planning/ implementation/ models/ review/ artifacts/`。

## 当前需求

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：阶段 3 TASKS 已于 2026-07-28 完成；技术路线为单 Nuxt 4 全栈应用、Nitro、SQLite/Drizzle 与 OSS 条件直传/图片处理。公开端与管理端分别建立 Design Brief、信息架构和 Token 契约，v5 仅作为页面职责/交互基线；正式 `TASKS.md` 含 T01–T53，均待阶段 4 授权后实施。SPEC/PLAN 待答 OQ 均为 0，当前无业务源码。
- [`需求1-兽装工作室主页/materials/兽装工作室主页调研_2026-07-26/`](./需求1-兽装工作室主页/materials/兽装工作室主页调研_2026-07-26/)：只读竞品调研证据。
