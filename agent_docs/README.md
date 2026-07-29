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

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：阶段 4 已于 2026-07-28 获授权，T01–T03 已完成。正式中文名已确认为“有点小狗工作室”，英文暂用 `dite dog`；适用领养/掉落作品一期公开人民币价格与作品短属性，永久私有原图上限为 30,000,000 字节并新增 OSS 配额门禁。当前已建立单 Nuxt 4 全栈应用、文件化运行配置与环境变量映射、Host 隔离、安全日志、共享 Zod 契约和公开/管理 DTO；SQLite/Drizzle、认证与 OSS 尚未开始。下一项为 T04，但用户当前明确要求不碰视觉设计，故尚未开始；SPEC/PLAN 待答 OQ 均为 0。
- [`需求1-兽装工作室主页/materials/兽装工作室主页调研_2026-07-26/`](./需求1-兽装工作室主页/materials/兽装工作室主页调研_2026-07-26/)：只读竞品调研证据。
