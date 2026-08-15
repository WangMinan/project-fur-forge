# agent_docs

本目录是项目的 spec-driven 工作区。每个需求目录维护自己的边界、规格、模型、计划、任务、状态和证据。后续需求只在明确条款上覆盖旧行为；未覆盖的安全、媒体、隐私和部署基线继续继承。

## 当前需求

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：已经落地的双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。
- [`需求2-站点导航与内容增强/`](./需求2-站点导航与内容增强/)：已经落地的二维码媒体链、名称搜索、FAQ、最新动态和五平台渠道等历史增量。
- [`需求3-站点业务简化与委托投递/`](./需求3-站点业务简化与委托投递/)：当前活跃需求。

需求3明确覆盖：

- 英文名改为 `DITE DOG`；
- 返图墙、最新动态及其数据/媒体立即永久退役；
- 官方联系方式收缩为邮箱、QQ、QQ群，不再维护抖音、小红书和 Bilibili；
- OSS Bucket CORS 保持当前通配 `*`，不把精确 Origin 或禁止 wildcard 作为门禁；
- Hero 横竖独立；
- 作品/详情仅名称、物种和图集；
- 删除装型、主人、联系人、属性、旧进度、领养方式和展会字段；
- 领养增加独立横版 cover；
- 新增 `/commission/apply` 与 `/admin/commissions`；
- FAQ 删除，`commission_email_action` 保留为备用邮件说明；
- 公开端动效升级，同时保留 reduced-motion。

需求1的媒体、安全、Host、部署和质量基线没有被放宽。需求2的二维码上传/派生和名称搜索继续生效；其五平台列表只作为历史实现事实，当前目标渠道由需求3限定为 `qq | qq_group`，邮箱继续单独维护。

## 权威顺序

需求3编码前按以下顺序读：

1. `foundation/README.md`
2. `requirements/SPEC.md`
3. `models/README.md`
4. `.design/README.md`
5. `planning/PLAN.md`
6. `planning/DATA-MIGRATION.md`
7. `implementation/TASKS.md`
8. `implementation/EXECUTION_ROUTING.md`
9. `STATE.md`

TASKS 是唯一勾选权威；dated notes、旧 Review、截图和历史 commit 只说明当时事实。

## 当前阶段

需求3文档已合入并于 2026-08-15 完成二次复查和本轮渠道/CORS 决策同步。应用代码、数据库和生产环境尚未实施需求3。

正确顺序：

```text
A 立即永久退役返图/动态并收缩联系渠道
  → B Expand 新模型与安全
  → C 动效与 Hero
  → D 作品与领养
  → E 委托投递
  → F 最终 Review、用户验收与发布
```

不得把返图/动态数据或已经取消的三类平台联系方式保留到其它功能完成后再处理。

## 执行纪律

- 默认通过任务分支与 PR 合入；用户对单次直接 main 写入的明确授权只适用于该次操作。
- 契约变化先同步 foundation、SPEC、models、PLAN、DATA-MIGRATION、TASKS 和 STATE。
- 后端/数据/安全 → 前端 → 本地演练 → 独立 Review → 用户验收 → 生产执行。
- 不重写已执行历史迁移，不删除 `.env`，不记录 Secret、PII、真实图片或完整 Object Key。
- 永久清理必须默认 dry-run、脱敏计数、强确认、停机、对象验证和 clean backup restore。
- 公开匿名上传仍需应用层 Origin/token/TTL/限流和签名 PUT 校验；OSS CORS 保持 `AllowedOrigin=*`，不设置收紧门禁。
- 自动化不能替代真实浏览器、真实手机、用户验收或生产控制台核对。
