# 模型说明

> **角色**：说明当前领域模型、敏感字段边界与迁移顺序。具体列类型和索引在 TASKS 中实现。

## 当前状态

T03 已建立共享 Zod Schema、DTO 与 mapper，但尚未创建 Drizzle Schema。2026-07-29 的文档校准废止了部分 T03 字段；T09 必须先修正共享契约，数据库不得照搬旧 DTO。

## P0 模型

- `users`：唯一管理员、安全状态、`sessionVersion`；P0 不要求邮件找回表。
- `works`：统一作品聚合；委托、领养和展示不拆表。
- `work_feature_tags`：每件作品 0–8 条有序短属性，不是 EAV。
- `assets`：原图元数据、摘要、尺寸、私有 Key、处理状态和配方身份。
- `asset_variants`：草稿私有衍生图与公开衍生图的相对 Key、用途、宽度、格式和摘要。
- `work_assets`：作品与设定图/出厂照/返图的关系、顺序和主图角色。
- `publication_operations`：记录跨 SQLite 与双 Bucket 的生成、验证、提交和清理进度；不记录 ACL 切换，不充当队列。
- `business_statuses`、`site_content`：受限的营业状态与必要站点内容。
- `audit_logs`：最小操作人、时间、对象和结果，不保存请求正文或敏感字段。

## P1 模型

- `return_photos`：返图公开元数据及可选私有授权记录。
- `events`：当前展会与作品关联。
- `slug_redirects`：显式改址产生的永久重定向。
- `trash_entries`：30 天回收站。
- 更完整的站点内容、FAQ 与排序记录。

## P2 模型

- `password_reset_tokens`；
- 导出任务/记录（仅在确有异步需要时）；
- 最小化汇总统计；
- 原图档案 UI 所需检索字段。

P2 不得提前污染 P0 表或导航。

## 字段规则

### 作品价格

- `price_amount_minor INTEGER NULL`；
- `price_currency TEXT NULL`，一期非空时只允许 `CNY`；
- 仅领养/掉落作品允许填写；
- 不创建任何禁用外币字段；未来多币种通过迁移放宽约束。

### 私有联系人

- 联系人可保留在管理员投影中；
- 不保存 `depositNote`、`paymentNote` 或等价字段；
- 联系人不进入公开 DTO、日志、导出默认视图或 URL。

### 返图授权记录

`consent_source`、`consent_confirmed_at`、`consent_note` 均可为空。它们只作轻量备忘，不阻止发布，不进入公开投影。

### 媒体

- 私有 Bucket 保存原图、草稿、临时与预览；公开 Bucket 只保存发布衍生图。
- `assets` 不把 Bucket 域名写入数据库；环境配置决定 Bucket 与媒体域名。
- 管理端浏览器以 `assetId` 操作媒体；私有 Key 只在服务端和数据库中使用。
- 公开衍生 Key 的身份覆盖原图摘要、裁切/焦点、用途、宽度、格式、质量、水印摘要和 `recipe-version`，不得原位覆盖。
- `publication_operations` 的状态应描述 `GENERATING_PUBLIC`、`VERIFYING_PUBLIC`、`COMMITTING`、`CLEANING_PUBLIC`、`FAILED`、`DONE` 等实际步骤，不再出现逐对象 ACL 进度。

## 约束

- `works.slug` 首次发布后默认冻结；改址写入 `slug_redirects`。
- 作品列表、领养列表、返图列表和首页精选排序相互独立。
- 每件作品最多 5 张出厂照和 5 张返图；领养作品另有 1 份设定图。
- 领养方式与六种业务状态分离；“展会出售中”要求展会掉落方式和当前展会。
- 原图字节数接受 `<= 30,000,000`，拒绝 `30,000,001`；最长边 12,000。
- 焦点与裁切以 EXIF 方向修正后的显示画布归一化保存。
- 自动化测试使用独立 SQLite 文件和独立 OSS `test/<run-id>/` 前缀。
