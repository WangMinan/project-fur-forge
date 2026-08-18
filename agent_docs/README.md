# agent_docs

本目录是 `project-fur-forge` 的 spec-driven 工作区。每个需求目录维护自己的地基、规格、模型、设计、计划、任务、状态、实施记录和评审证据。后续需求只在明确条款上覆盖旧行为；未覆盖的安全、媒体、隐私和部署基线继续继承。

## 当前需求

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：已落地的双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。
- [`需求2-站点导航与内容增强/`](./需求2-站点导航与内容增强/)：二维码媒体链、名称搜索等历史增量；五平台、返图、FAQ 和最新动态等行为已被后续需求覆盖。
- [`需求3-站点业务简化与委托投递/`](./需求3-站点业务简化与委托投递/)：当前已实现的业务基线，包括 `DITE DOG`、退役内容、Hero 横竖集合、简化作品/领养和私密委托投递。
- [`需求4-站点视觉升级与内容合规/`](./需求4-站点视觉升级与内容合规/)：**当前活跃需求**。在需求3代码基础上升级首页设计/动效、Hero 焦点、委托告知与人工删除、服务条款和第三方声明。

## 需求4明确覆盖

### 视觉和首页

- 首页继续覆盖完整核心业务，但重排为“品牌 Hero → 代表作品 → 自设委托 → 设定领养”四幕；
- PC Web 为第一视觉基准，移动端同步做等价重排；
- 一个视口一个主要注意力中心，以真实大图、短文案和克制行动建立品牌节奏；
- 动效只表达反馈、阅读进程、媒体序列和对象连续性；
- 不做 scroll-jacking、长时间 pinned scroll、强制横向叙事、持续视差或为“Apple 感”强行弹跳；
- Hero 焦点复用现有 `assets.focal_x/focal_y`，首版只提供可选九宫格。

### 委托、隐私和条款

- 站内表单负责结构化投递；官方 QQ 私聊负责优先后续沟通和逐单确认；邮箱备用；QQ群不是默认订单确认渠道；
- 申请人必须确认已满 18 周岁、已阅读当前隐私政策，并理解提交不等于接单；
- 新申请记录确认版本；历史申请保留 legacy，不回填虚假确认；
- 个人信息和私有设定图按业务、保修、争议和法律必要期限保存；
- 人工决定清理时机，受控 CLI 完成 DB/OSS 一体删除；不建设自动定时任务或通用生命周期引擎；
- 网站服务条款是一般规则；具体价格、付款、排期、修改和特殊约定在官方 QQ 中逐单确认；
- 默认关于我们、委托、隐私、服务条款和防诈骗文案按真实功能重写。

### 第三方声明

- npm 生产依赖声明从实际 lockfile/安装结果确定性生成；
- FFmpeg 按“自有服务器容器内部使用、当前不对外分发”记录；
- Noto Serif SC 按 SIL OFL 1.1；
- 拙黑拼贴体来自 Lemi Font 免费商用声明，作为第三方授权字体留档，不误称开源；
- 不新增 GitHub required check 或独立重型工作流。

## 需求4权威顺序

编码前按以下顺序阅读：

1. [`需求4-站点视觉升级与内容合规/STATE.md`](./需求4-站点视觉升级与内容合规/STATE.md)
2. [`foundation/README.md`](./需求4-站点视觉升级与内容合规/foundation/README.md)
3. [`requirements/SPEC.md`](./需求4-站点视觉升级与内容合规/requirements/SPEC.md)
4. [`requirements/COPY.md`](./需求4-站点视觉升级与内容合规/requirements/COPY.md)
5. [`models/README.md`](./需求4-站点视觉升级与内容合规/models/README.md)
6. [`.design/README.md`](./需求4-站点视觉升级与内容合规/.design/README.md)
7. [`planning/PLAN.md`](./需求4-站点视觉升级与内容合规/planning/PLAN.md)
8. [`planning/DATA-MIGRATION.md`](./需求4-站点视觉升级与内容合规/planning/DATA-MIGRATION.md)
9. [`implementation/TASKS.md`](./需求4-站点视觉升级与内容合规/implementation/TASKS.md)
10. [`review/REVIEW.md`](./需求4-站点视觉升级与内容合规/review/REVIEW.md)

`TASKS.md` 是唯一勾选权威；`STATE.md` 记录当前事实；dated notes、旧 Review、截图、聊天摘要和历史 commit 只能说明当时状态。

## 当前阶段

需求4文档已于 2026-08-19 锁定，应用代码、数据库迁移、默认文案、视觉改版、人工删除工具和生产环境尚未实施。

正确顺序：

```text
A 内容/隐私地基
  → B 人工删除与第三方声明
  → C 设计系统与 Hero 焦点
  → D 首页四幕与对象连续性
  → E 全站 Review、用户验收与发布
```

视觉工作不得先于隐私/申请告知发布门禁完成。

## 执行纪律

- 默认使用任务分支与 PR；只有用户对当前操作明确授权直接 main 时才例外。
- 写前 fetch，核对 main SHA；不 force push、不 hard reset、不覆盖用户改动。
- 契约变化先同步需求4 foundation/SPEC/COPY/models/design/PLAN/DATA-MIGRATION/TASKS/STATE。
- 不重写已执行历史迁移，只新增前向迁移。
- 不记录 Secret、token、签名 URL、PII、真实私有图片、QQ 聊天或完整 Object Key。
- 数据/媒体删除默认 dry-run、脱敏计数、强确认、精确对象、验证和幂等重入。
- 人工清理是“人判断 + 工具执行”，不是手工 SQL/控制台漏删。
- 需求1的 Host、私有媒体、OSS/ESA、发布、恢复、备份和部署纪律继续生效。
- OSS Bucket CORS 保持当前 `AllowedOrigin=*`；匿名 API 仍需应用层 Origin/token/TTL/限流/蜜罐。
- 当前 Actions 和 main 规则保持不变；不新增 required check。
- 实现、focused review、独立 Review、用户验收和生产发布互不代签。
