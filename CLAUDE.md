# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

project-fur-paws —— 为朋友的兽装（fursuit）工作室制作的主页网站。

> **当前阶段：阶段 3 TASKS 已完成，仍无业务源码。** 技术路线已确定为单 Nuxt 4 全栈应用、Nitro、SQLite/Drizzle 与阿里云 OSS；公开端与管理端的生产设计输入已分别沉淀在 `.design/`，`implementation/TASKS.md` 已形成正式任务清单。规划原型 v5 只锁定页面职责、内容顺序和关键交互，不代表生产视觉完成度。**在用户明确授权进入阶段 4 前，不要搭建项目或编写业务代码。**

## 网站核心原则（景宸确认）

> **就是要简洁，以图片为主；Logo、文字介绍以及符号等元素，都是为兽装展示做辅助的。**

这是后续需求、设计、实现与评审的最高层视觉原则：

- **展示主体只有兽装。** 页面首先服务于兽装作品的观看与浏览，视觉层级始终以兽装图片为最高优先级。
- **保持简洁。** 控制非必要的信息、装饰和交互，不以复杂版式、动效或视觉技巧抢夺作品本身的注意力。
- **图片是主要表达方式。** 页面结构、留白和内容节奏应优先保障图片的尺寸、清晰度与连续浏览体验。
- **Logo、文字和符号均为辅助。** 它们只承担品牌识别、必要说明、导航和状态提示等功能；不得遮挡图片、压缩图片展示空间或形成比作品更强的视觉焦点。
- **文字简短且必要。** 能由作品图片表达的内容不重复堆砌文案；保留的文字应帮助访客识别、理解或继续浏览作品。
- **以是否有助于兽装展示作为取舍标准。** 新增任何非图片元素前，都要说明它如何帮助作品识别、理解或浏览；无法说明时，应删除或弱化该元素。

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

业务工程尚未创建，因此暂无 Nuxt 构建命令。当前规划原型的验证入口与命令见 `agent_docs/需求1-兽装工作室主页/planning/prototype-v1/README.md`；阶段 4 从 `implementation/TASKS.md` 的 T01 开始时建立正式构建/测试命令。

## 当前仓库状态

仅有文档脚手架、阶段 2 规划原型和阶段 3 的 `.design/`/`TASKS.md` 产物：`CLAUDE.md`、`AGENTS.md`（软链接）、`agent_docs/`、`.gitignore`。无业务源码、无生产构建产物。
