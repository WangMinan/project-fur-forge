# 产物索引：需求4

> **角色**：登记需求4文档、实施证据与外部依据。
> **状态**：文档阶段产物已定稿；实现、评审和生产产物待补。

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 地基 | 地基 | `../foundation/README.md` | 定稿 | 继承、模块、安全、Git与非目标 |
| 1 规格 | 需求规格 | `../requirements/SPEC.md` | 定稿 | 产品与验收唯一真理来源 |
| 1 规格 | 目标文案 | `../requirements/COPY.md` | 定稿待工作室终审 | about/commission/privacy/terms/licenses |
| 1 设计 | 设计说明 | `../.design/README.md` | 定稿待视觉实现 | 四幕、动效、焦点、移动和验收 |
| 2 模型 | 模型说明 | `../models/README.md` | 定稿 | 焦点复用、申请 v2、删除和 notices |
| 2 计划 | 实施计划 | `../planning/PLAN.md` | 定稿 | A～E 执行顺序 |
| 2 迁移 | 数据迁移 | `../planning/DATA-MIGRATION.md` | 定稿 | expand、文案、删除、回滚与证据 |
| 3 任务 | 任务清单 | `../implementation/TASKS.md` | 定稿 | 唯一勾选权威 |
| 4 实施 | 实施备注 | `../implementation/notes/README.md` | 已建立 | 后续按日期追加 |
| 5 评审 | 评审记录 | `../review/REVIEW.md` | 预实施 Review 完成 | 实现后独立 Review 待执行 |
| 6 闭环 | 状态 | `../STATE.md` | 已同步 | 当前阶段与下一棒 |

## 外部资料

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 设计站点 | `https://www.apple.com.cn/` | 大图、一屏一重点、短行动 |
| 同行业站点 | `https://yuwufursuit.com/` | 首页完整业务地图 |
| 同行业站点 | `https://www.ww-pass.com/wp-fursuit/` | 全屏 Hero 与不等面积模块 |
| 设计方法 | `https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md` | 即时反馈、空间一致性、材料、排版与 reduced preferences |
| 法律原文 | `https://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html` | 个人信息告知、保存与删除 |
| 法律原文 | `https://www.tlf.gov.cn/tlfs/c106219/202106/b73eecdb3e86426ba3a542f5aafc9882.shtml` | 格式条款提示与公平边界 |
| 工具文档 | `https://pnpm.io/cli/licenses` | 生产依赖许可证事实 |
| 字体来源 | `https://font.leminet.cn/#/` | 拙黑拼贴体免费商用来源 |

## 待实施产物

- 数据库前向迁移与验证记录；
- intake metadata/申请 v2 API 契约测试；
- 人工 retention/deletion CLI 与 SOP；
- `third-party-notices.json` / `THIRD_PARTY_NOTICES.txt`；
- 真实素材多视口截图/录像；
- 九宫格裁切与 publication 证据；
- 完整 E2E、性能和 PII leakage 结果；
- independent Review；
- 用户验收；
- 生产迁移、smoke 和人工清理交接。
