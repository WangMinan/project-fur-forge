# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

project-fur-paws —— 为“有点小狗工作室”（英文暂用 `dite dog`）制作的兽装（fursuit）主页网站。

> **当前阶段：阶段 4 IMPLEMENTATION，T01–T20、GATE-06、GATE-07 与 EXT-02 已完成。** T21 首次独立审查为 NOT PASS；findings 已完成实现者侧修复，等待未参与修复的审查者重新执行真实 OSS 门禁，T21 保持未勾选。

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

Node.js 24 LTS 与 pnpm 11.18 为当前基线：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify:production
```

当前规划原型的独立验证入口仍见 `agent_docs/需求1-兽装工作室主页/planning/prototype-v1/README.md`，不得把原型样式复制进生产应用。

## 当前仓库状态

根目录现含 Nuxt 4 工程、`app/`、`server/`、`shared/`、`scripts/`、`tests/` 与阶段文档。T10/EXT-02 已验证双 Bucket 与大原图处理链；T11–T13 已落地 SQLite/Drizzle、P0 Schema/投影和唯一管理员认证；T14–T18 已完成条件直传、媒体核验/大图预处理、`recipe-v1`/基础水印、非领养作品 CRUD、发布/下架补偿及管理端接线。`brand-standard-v1` 当前开发基线为最终输出宽度 18%；T51 负责最终跨素材参数校准。
