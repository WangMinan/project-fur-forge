# 阶段 0 · 地基

## 授权与继承

- 2026-09-06 用户要求新增 SMTP 委托通知，先按模板建立需求5文档。随后用户同意规格并授权当前分支编码。本需求明确覆盖历史“不得新增 SMTP”限制中的内部委托通知部分；不重开需求1～3或改变需求4状态。
- 用户确认发件账号为 `wangminan0811@qq.com`，接收方是工作室内部邮箱，通知须含全部表单业务文字和设定图附件。
- 用户明确要求用户侧页面及所有文字不变，包含隐私政策。此为本轮产品决定，不记为已进行法律合规评审；不得在实现时擅自改公开告知。
- 继续继承 [需求3地基](../../需求3-站点业务简化与委托投递/foundation/README.md) 的私有媒体、上传校验、双 Host、管理认证与删除边界，及 [需求4规格](../../需求4-站点视觉升级与内容合规/requirements/SPEC.md) 中未被本需求明确覆盖的业务契约。

## 模块边界

- `server/utils/service/commission-management.ts`：在委托创建这一共同入口记录通知意图，发送在事务提交后执行。
- `server/utils/repository/`、`server/utils/runner/`：最小持久发送记录、领取与重试、SMTP 和私有附件读取；不得把网络请求放进 SQLite 事务。
- `server/utils/service/site-content.ts`、`shared/schemas/site-content.ts` 与 contact 管理 API：新增仅管理员可见的收件列表，复用分区保存、版本冲突和安全入口。
- `app/components/admin/SiteOfficialChannelsCard.vue`、后台内容页和导航：联系方式分区新增列表，统一页名为“站点配置”。
- 运行时配置、Compose 注入、`.env` 与两个环境示例：实施时接入 SMTP。当前 Compose 显式列举环境变量，只增加示例行不能证明容器会取得配置。
- `app/pages/admin/commissions/`：提供必要的通知状态与失败重试反馈，不改变 `pending | accepted | rejected` 业务状态。
- 公开页面、公开联系方式与公开 DTO 保持原状；内部收件列表不能复用 `contact_email` 或 `official_channels_json` 的公开展示含义。

## 接口口径

- 公开创建入口仍为 `POST /api/public/v1/commission-submissions`，成功仍返回既有 `receiptCode`。
- 管理内容仍由 `GET /api/admin/v1/site/home/content` 读取，`PUT /api/admin/v1/site/home/content/contact` 按 `expectedVersion` 更新联系方式分区。
- 通知重试仅在已有管理认证、安全路由约束下开放，不增加公开查询或任意地址发信接口。

## 数据库口径

- 继续使用当前 SQLite、`commission_submissions` 与 `site_content`；仅新增前向迁移，不改历史迁移。
- 通知唯一身份为“委托 + 规范化收件邮箱”；记录关联与投递状态，不另存一整份申请正文或图片。
- 默认邮箱只在首次初始化新增字段时写入；后续启动、迁移或读取不能覆盖管理员编辑或恢复已删除的邮箱。
- 删除委托时同步取消关联未完成通知、清理通知记录；和发送中的竞争必须处理，不绕开既有受控删除流程。

## 安全约定

- SMTP 授权码只写入本地未跟踪 `.env` 或目标环境秘密配置；示例密码留空或使用占位值。不读取或输出无关 `.env` 值。
- 发件账号和凭据由服务端配置控制，后台只维护内部收件地址；不接受用户指定邮件头、附件路径或 URL。
- 设定图仅通过现有服务端私有读取链获取；邮件附件不改变 OSS 私有权限，不生成 PUBLIC variant、ESA URL 或私有签名 URL。
- 申请资料、邮箱地址、SMTP 原始响应和凭据不得进入普通日志、错误、analytics、公开 HTML/DTO 或真实 fixture。
- 工作室需在资料删除流程中处理收件箱、已发送箱等邮件副本；网站删库不能撤回已投递邮件，本期不接 IMAP 或邮箱删除 API。

## 编码与命名约定

- 复用现有 service / repository / runner 分层、Schema 校验、`safeLog`、配置加载与后台表单组件。
- 不增加 Redis、独立邮件微服务、通用通知平台或邮件模板编辑器；具体模型见 [models](../models/README.md)。
