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

> 当前 `_template/` 来自 spec.template，尚无任何需求目录。
