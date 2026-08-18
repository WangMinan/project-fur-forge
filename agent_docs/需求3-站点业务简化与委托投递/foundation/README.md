# 需求3 · 产品地基

> **角色**：固定本轮站点业务简化、公开动效、委托投递和破坏性退役的不可突破边界。
> **基线**：继承需求1的双 Host、私有媒体、OSS/ESA、安全、部署与验收基线；继承需求2仍适用的二维码媒体链和名称搜索。
> **覆盖**：本目录对品牌英文名、返图墙、最新动态、官方渠道列表、OSS CORS、Hero、作品字段、领养方式和委托入口的明确规定覆盖旧产品行为；未明确改变的需求1基线继续有效。
> **校准**：2026-08-15 文档复查及用户追加口径后修订。

## 1. 产品方向

站点从“功能较全的工作室 CMS”收敛为：

```text
摄影成果展示 + 设定领养 + 委托线索收集
```

本轮目标：

1. 第一阶段立即永久退役返图墙和最新动态；
2. 第一阶段把官方联系方式收缩为邮箱、QQ、QQ群；
3. 英文品牌名恢复为 `DITE DOG`；
4. 公开端增加有节奏的导航、页面和图片动效；
5. 首页与委托页横版/竖版 Hero 完全独立维护；
6. 作品只维护名称、物种、图片和必要内部发布字段；
7. 领养使用独立横版单头成果图；
8. 新增 `/commission/apply` 与 `/admin/commissions`。

## 2. 已锁定决策

- 英文品牌名：`DITE DOG`，不得继续使用 `DITE DOG FURSUIT`。
- 首页 slogan：`不只做小狗毛 | 只做海绵头`。
- 返图墙和最新动态不是“暂时隐藏”，而是删除页面、API、数据表、私有原图、派生图和相关应用代码。
- 退役工作是本需求第一实施阶段，不得拖到其它功能全部完成后。
- 退役路由不做重定向，移除后返回普通 404。
- 官方联系方式只维护：独立邮箱、`qq`、`qq_group`。
- `douyin`、`xiaohongshu`、`bilibili` 不再作为可配置平台，不在公开页、管理端、Schema、DTO、测试或目标持久模型中保留槽位。
- 三类退役平台的账号值不迁移到备注或隐藏字段；其二维码引用移除后，失去引用的 `contact_qr` 资产按现有媒体清理规则删除。
- OSS Bucket CORS 继续保持当前 `AllowedOrigin=*`，不要求收紧为精确 Origin，也不把 wildcard 作为门禁失败。
- 应用自己的匿名 API 继续校验 Origin、Content-Type、token、TTL、限流、蜜罐和一次性消费；OSS CORS 通配不能替代这些校验。
- 公开端取消“尽量少动效”的旧审美限制，但必须保留 `prefers-reduced-motion`。
- Hero 四个集合独立维护：`home|commission × landscape|portrait`；首页集合允许 1–5 张已启用图片轮播，委托集合每方向同时只启用 1 张、允许全部停用后替换。
- 桌面 Hero：中文主标题居中；`DITE DOG` 与 slogan 位于下一行左右两侧。
- 移动 Hero：整组文字左对齐并下移；不得强行复用桌面居中布局。
- `/works` 与 `/works/{slug}` 只公开名称、物种和图片。
- 删除装型、主人公开值、私有联系人、属性标签、旧制作进度、领养方式和展会字段。
- 领养状态收敛为 `available | adopted`，价格继续可选。
- adopted 作品仍可按 `featured` 进入首页精选；首页“设定领养”只投影 available，若无 available 则整区隐藏。
- 首页、作品列表和领养列表统一以“名称 · 物种”展示作品标识，点号两侧保留空格；已领养状态使用非绿色中性色。
- 每件已发布领养作品必须有独立横版 `adoption_cover` 和竖版主 `studio_photo`。
- 设定图最多一张，只作为可选详情素材。
- 委托申请恰好一张设定图；称呼、+86 手机号、QQ、身高、体重均必填。
- 委托后台状态固定为 `pending | accepted | rejected`。
- 不接 SMTP、短信、用户账号、公开查询或自动建作品。
- 只永久删除委托 FAQ 及其维护链；`commission_email_action` 不属于本轮破坏性删除范围，邮件只降级为关于页的备用渠道。

## 3. 第一发布单元边界

第一实施阶段必须完成：

- 删除 `/returns`、`/returns/{slug}`、`/updates`；
- 删除 `/admin/returns/**`、`/admin/updates`；
- 删除对应导航、首页摘要、API、Schema、repository、service、runner、recipe、fixture 和测试；
- 永久删除 `updates`、`return_characters`、`return_photos`；
- 删除返图对应资产、上传会话、变体、发布 operation 和 analytics 行；
- 删除私有原图、preprocess、preview、公开派生、未完成上传对象；
- 若 OSS 开启版本控制，删除对应历史版本和 delete marker；
- 对公开文件执行精确 ESA purge；
- 把 `CONTACT_PLATFORMS`、管理/公开 Schema 与 `official_channels_json` 收缩为固定 `qq | qq_group`；
- 移除抖音、小红书、Bilibili 的账号和二维码引用，删除确认无其它引用的对应二维码源图/派生；
- 在净化备份恢复验证后，删除应用管理范围内仍含退役数据的旧备份。

外部云盘快照、主机镜像或第三方备份不由应用脚本臆测删除，必须列入生产操作员检查表，由用户在对应控制台确认。

## 4. 模块边界

- 品牌：`shared/constants/project.ts`、SEO、结构化数据、静态文字资产和测试。
- 联系渠道：`shared/constants/contact.ts`、site-content Schema/service、`official_channels_json`、二维码上传/派生、管理 Card、`/about` 和 `/commission`。
- 导航与动效：公开 Header、MobileNav、公共布局、设计 Token 和首页组件。
- Hero：公开 DTO、管理页、Schema、repository、runner、recipe、上传与发布链。
- 作品与领养：`works`、`work_assets`、作品管理、公开 repository、媒体 recipe。
- 委托：新公开表单、匿名上传会话、私有设定图、管理队列和隐私文案。
- 退役：返图/动态所有当前代码、数据、媒体、路由、测试和生产验证。

## 5. 媒体边界

- 公开作品、领养和 Hero 只消费验证完成的 ESA HTTPS 派生图。
- `studio_photo`：作品 3:4 主图与详情图集。
- `adoption_cover`：横版单头成果图，只服务领养卡及首页当前领养。
- `design_sheet`：每件作品 0..1，仅作可选详情素材。
- `commission_design_reference`：只保存私有源图和必要私有验证结果，不生成 PUBLIC variant、不进 ESA、不加水印。
- `contact_qr` 继续服务 QQ 与 QQ群；抖音、小红书、Bilibili 的二维码引用取消后，孤立资产必须按现有安全清理流程处理。
- Hero 横竖继续使用无水印 site-display 派生，但按独立集合发布。
- 不从设定图或竖版全装图自动裁切 `adoption_cover`。

## 6. 委托隐私与上传

- 称呼、手机号、QQ、身高、体重、内部备注和设定图均为私有数据。
- 匿名上传不得放宽管理员 `upload_sessions.created_by`、CSRF 或 owner 约束；使用独立短时、一次性会话。
- 复用既有 OSS 条件 PUT、HEAD、MD5/SHA-256、MIME、尺寸、图片解码和清理基础函数。
- OSS Bucket CORS 继续保持 `AllowedOrigin=*`，不新增精确 public/admin Origin 收紧任务，不设置“禁止 wildcard”的生产门禁。
- 匿名请求仍必须校验应用 API Origin、Content-Type、body size、token、TTL、限流、蜜罐和一次性消费。
- 私有字段不得进入公开 DTO、HTML、URL、analytics、普通日志、错误文本或真实测试 fixture。
- 管理图片预览必须认证、短时、`Cache-Control: no-store`。

## 7. 迁移纪律

- 不重写已执行历史迁移，只新增前向迁移和受控清理工具。
- 退役清理默认 dry-run、脱敏计数、强确认、停机执行。
- 必须先根据仍存在的数据库关系精确枚举并删除媒体，再 DROP 表。
- 联系渠道迁移先提取 `qq` 与 `qq_group`，再重建两平台约束；三类退役平台不保留兼容投影。
- 退役二维码资产只有在确认不再被任何渠道或内容引用后删除。
- 任何对象删除未完成时不得执行对应数据库 contract。
- 旧应用管理备份在新的净化备份完成并恢复验证后删除，不得提前牺牲全部数据库恢复能力。
- 退役 contract 完成后旧镜像不保证兼容，故障使用新镜像前向修复。
- 后续作品字段 contract 与第一发布单元是两个不同迁移单元，不得混为一次巨型停机操作。

## 8. 明确不做

- 不保留返图或动态归档、CSV、隐藏后台、恢复包或长期 Key manifest。
- 不继续维护抖音、小红书或 Bilibili 平台槽位、账号、二维码或公开卡片。
- 不建设交易、支付、排期、合同、自动报价、自动接单或多管理员。
- 不建设委托公开查询、撤回、编辑或自动转作品。
- 不增加多图委托设定提交。
- 不建设通用 CMS、富文本、页面搭建器或第三方搜索服务。
- 不删除 `commission_email_action`、`contact_qq` 兼容列或其它未被用户明确授权的数据；`contact_douyin` 已因本轮明确取消抖音维护而进入迁移删除范围。
- 不把 OSS CORS 收紧为精确 Origin，不把通配 `*` 视为验收失败。
- 不移除 reduced-motion、键盘、焦点管理和双 Host 安全边界。
