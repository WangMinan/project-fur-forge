# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

project-fur-paws —— 为朋友的兽装（fursuit）工作室制作的主页网站。

> **当前阶段：构思/规划中。** 暂无源码，技术栈尚未确定。**在用户明确要求开始设计前，不要主动搭建项目、选型或编写业务代码。** 仅做用户明确请求的初始化工作。

## 工作流：spec-driven 开发（agent_docs）

本项目遵循 `D:\code\spec.template` 的 spec-driven 开发流程（对齐 [github/spec-kit](https://github.com/github/spec-kit)）。所有需求文档放在 `agent_docs/` 下，每个需求一个文件夹。

- **编码前先读** 该需求文件夹的 `STATE.md` 与 `foundation/README.md`。
- 开新需求：`cp -r agent_docs/_template/ agent_docs/需求N-<短描述>/`
- 七阶段闭环：地基 → 规格 → 计划 → 任务 → 实施 → 评审 → 闭环。
- **OQ 门禁（硬性，最高优先级）**：阶段 1（规格）与阶段 2（计划）的开放问题 `OQ-NNN` 必须全部「已答/已搁置」才能进入下一阶段或编码。遇到无法自答的问题 → 登记 OQ → 停下等用户解答，**绝不假设答案推进**。
- 契约先行：编码前 SPEC 锁定接口/数据/存储契约；代码偏离契约即 bug。契约变更先改 SPEC 再改代码。
- 完整流程与分工矩阵见 `D:\code\spec.template\AGENTS.md`。

`AGENTS.md`（项目根）为指向本文件的软链接，供其他 coding agent 复用同一套指令。

## 常用命令

暂无。技术栈与构建/测试命令待确定后在此补充。

## 当前仓库状态

仅有脚手架：`CLAUDE.md`、`AGENTS.md`（软链接）、`agent_docs/`、`.gitignore`。无源码、无构建产物。
