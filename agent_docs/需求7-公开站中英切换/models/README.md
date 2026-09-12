# 模型说明

## 当前状态

以下处理规则已实施：公开 schema/API 移除价格，语言/展示逻辑接入完成；数据库与管理字段未改，不新增表或 migration。

| 数据 | 当前来源 | 目标处理 |
| --- | --- | --- |
| 语言 | 无 i18n | 仅 zh-CN/en；模块状态与 Host 范围 Cookie，默认和全部检测失败回退中文 |
| 公开作品名称/物种/alt/slug/href/媒体 | 现有公开 DTO | 原值保留，不增英文栏位或语言参数 |
| 委托营业状态 | tone＋管理员 label | 中文 label；英文按 open/closed 映射，不改状态值 |
| 工作室与委托文章 | site-content | 中文来源保留；其他语言按 locale＋section 存在 site_content_translations，独立版本 |
| 条款/隐私正文 | about.basicTerms / privacyPolicy | 保留中文，展示标注原文语言；涉及渠道变化的中文措辞另行校对 |
| 联系方式 | QQ/群二维码模型及邮箱 | 中文保留，英文 X＋邮箱；X 来自 site_content.x_contact_url，共用 contact 分区版本；不扩展平台枚举 |
| 公开价格 | publicAdoptionWorkDtoSchema、详情 adoption、列表/首页投影 | 删除公开 price 及其字段引用；管理金额和存储保留 |
| sitemap 路径 | 分页目录默认页 | 从相同安全快照取得完整详情路径，保留资格和去重 |
| 中文申请状态 | 页面 form/file/receiptCode/stage | 同页语言切换保留；忙碌时禁止切换，不存入持久浏览器存储 |

公共业务值、管理员数据与展示译文分开处理，避免改共享中文标签时使后台跟随英文；后台未实施国际化。

## 站点文案存储与 API

- `site_content_translations(locale, section, fields_json, version, updated_at)`；主键 `(locale, section)`。JSON 是数据库内的有限分区字段载荷，经共享 Zod schema 校验，不是部署目录里的内容配置文件。
- `section` 固定为 home / commission / about / status。非中文记录不存在时 version=0，首次写入创建；之后精确 CAS。每个分区独立版本，互不覆盖。
- 中文 commission/about 使用原分区版本，status 使用 business_statuses.version，home 新增 home_content_version；原中文 API 仍写同一数据源。
- 管理 GET `/api/admin/v1/site/home/content/localized/:locale` 返回该语言分区及只读中文参考；PUT `/:locale/:section` 接受 expectedVersion、payload，复用现有管理 Host/会话/Origin/CSRF 边界。
- 公开 site-content 与 home-aggregate 增加 copy，仅投影已启用语言的公开字段。SSR 与客户端切换共用逐字段中文回退；不按请求语言分裂公共 DTO 或存储状态。
- UI 字段定义集中于 shared/schemas/site-copy.ts；语言与申请/联系模式集中于 shared/constants/site-locales.ts。
