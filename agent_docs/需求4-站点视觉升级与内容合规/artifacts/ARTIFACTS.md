# 产物索引：需求4

> **角色**：登记需求4文档、实施证据与外部依据。
> **状态**：2026-08-20 已收口 T04～T22、T24～T34 开发产物与本地证据；T23 人工成文、T35/T36 部署分发证据、独立 Review、用户验收与生产执行仍待补。

## 文档产物

| 阶段 | 产物 | 路径 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| 0 地基 | 地基 | `../foundation/README.md` | 定稿 | 继承、模块、安全、Git与非目标 |
| 1 规格 | 需求规格 | `../requirements/SPEC.md` | 定稿 | 产品与验收唯一真理来源 |
| 1 规格 | 目标文案 | `../requirements/COPY.md` | 定稿待工作室终审 | about/commission/privacy/terms/licenses |
| 1 设计 | 设计说明 | `../.design/README.md` | 定稿待视觉实现 | 四幕、动效、焦点、移动和验收 |
| 2 模型 | 模型说明 | `../models/README.md` | 定稿 | 焦点复用、轻量申请确认、单条删除和 notices |
| 2 计划 | 实施计划 | `../planning/PLAN.md` | 定稿 | A～E 执行顺序 |
| 2 迁移 | 数据迁移 | `../planning/DATA-MIGRATION.md` | 定稿 | 无 Schema 变更项、文案、删除、回滚与证据 |
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
| 法律原文 | `https://www.cac.gov.cn/2021-08/20/c_1631050028355286.htm` | 个人信息告知、保存与删除 |
| 法律原文 | `https://wb.flk.npc.gov.cn/flfg/PDF/bd53dd912c1048f2aecbaa229238334b.pdf` | 格式条款提示、公平与效力边界 |
| 工具文档 | `https://pnpm.io/cli/licenses` | 生产依赖许可证事实 |
| 许可证依据 | `https://ffmpeg.org/legal.html` | FFmpeg 二进制分发、对应源码与构建信息 |
| 分发事实 | `https://hub.docker.com/r/wangminan/project-fur-forge` | 当前公开容器镜像发布面 |
| 字体来源 | `https://font.leminet.cn/#/` | 拙黑拼贴体免费商用来源 |

## 已实施产物

- 前向文案迁移：`../../../server/database/migrations/0045_r4_default_copy.sql`；
- 两项申请确认、service 再校验与 upload 未消费负向测试；
- 单条 retention/deletion repository/service/API/CLI/UI 与隔离 fake-storage 核心测试；
- 人工 SOP：`../implementation/COMMISSION-RETENTION-SOP.md`；
- notices JSON：`../../../app/assets/licenses/third-party-notices.json`；
- notices TXT：`../../../app/assets/licenses/THIRD_PARTY_NOTICES.txt` 与公开下载副本；
- 390×844、768×1024、1440×900 的委托确认、rejected 删除入口与 privacy/service/licenses 浏览器 smoke。

## 待实施/人工产物

- 真实经营主体隐私政策人工成文与工作室终审；
- Linux 发布镜像内 FFmpeg 二进制、对应源码、构建信息与 Docker Hub 可见性证据；
- 真实素材多视口截图/录像；
- 九宫格裁切与 publication 证据；
- core/smoke/release、性能和 PII leakage 结果；
- independent Review；
- 用户验收；
- 生产迁移、smoke 和人工清理交接。
