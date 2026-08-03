# T26–T27 服务端交接

## 结果

T26–T27 所需的受限站点内容、委托/领养独立营业状态、版本化管理 API 和公开安全投影已完成。T26、T27 仍未勾选；公开页面、现有首页管理页接线、独立 Review 和用户验收留给后续批次。

本批次没有建设万能 CMS、自由 HTML/Markdown、制作排期、经营看板、客户管理、站内估价/表单，也没有新增第五个后台导航。

## 数据与迁移

迁移：`server/database/migrations/0012_t26_t27_site_content.sql`。

- `business_statuses` 继续只允许 `commission | adoption` 和 `open | limited | closed`；新增 kind/href 成对约束与正版本约束。两行独立版本，互不递增。
- `site_content` 新增明确 nullable 列：
  - `commission_intro`；
  - `commission_estimate_note`；
  - `commission_email_action`；
  - `commission_faq_json`，只保存严格 `{ question, answer }[]`；
  - `about_studio_facts`；
  - `about_making_scope`；
  - `basic_terms`；
  - `contact_douyin`；
  - `contact_anti_scam`。
- 已登记的抖音 `to3114559925` 随迁移写入；既有邮箱和 QQ 原值保留。其他未确认文案全部保持 `NULL`，FAQ 读取为空数组，没有占位 seed。
- 迁移重建 `site_content` 前后显式重建既有 `upload_sessions_owner_insert` 触发器，现有上传版本门禁不丢失。

本地开发库已执行 `pnpm db:migrate`：应用 1 项迁移并创建迁移前备份；迁移后 13 项记录、`integrity_check=ok`、上传会话 owner 触发器存在。

## 管理 API

全部位于既有首页管理聚合下，继续由全局中间件执行后台 Host、Session、Origin、CSRF 与私有 `no-store`：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/v1/site/home/content` | 读取固定内容、公开渠道和两类营业状态；含管理版本 |
| `PUT` | `/api/admin/v1/site/home/content` | 按 `site_content.version` 原子替换 T26–T27 固定内容；邮箱/QQ 仍由既有首页 settings API 维护 |
| `PUT` | `/api/admin/v1/site/home/business-statuses/{commission|adoption}` | 独立创建或更新单类营业状态 |

营业状态不存在时返回 `null`，第一次写入提交 `expectedVersion: 0`；创建后返回版本 1，后续按该行版本更新。陈旧版本统一返回 `409 CONFLICT`。href 不由请求提交：委托固定 `/commission`，领养固定 `/adoptions`。

固定内容提交结构：

```json
{
  "expectedVersion": 1,
  "payload": {
    "commission": {
      "intro": null,
      "estimateNote": null,
      "emailAction": null,
      "faqs": []
    },
    "about": {
      "studioFacts": null,
      "makingScope": null,
      "basicTerms": null
    },
    "contact": {
      "douyin": "to3114559925",
      "antiScam": null
    }
  }
}
```

## 校验边界

- 委托短说明/邮件行动最多 240 字，人工估价/防诈骗最多 600 字；
- 工作室事实/制作范围最多 1200 字，基本约定最多 8000 字；
- FAQ 最多 8 项，问题 120 字、回答 1000 字，同一问题不得重复；
- 抖音为 2–30 位 Unicode 字母/数字、点、下划线或连字符；邮箱和 QQ 继续复用既有标准邮箱及 5–12 位非 0 开头数字校验；
- 所有内容去首尾空白，只作为纯文本；拒绝尖括号 HTML、`javascript:` / `vbscript:`、`data:text/html`、script/iframe 和 Markdown 脚本链接；
- 请求体保持 64 KiB 上限和严格字段，不接收未知键。

## 公开投影

`GET /api/public/v1/site-content` 显式返回 `Cache-Control: no-store`，每次请求直接读取当前 SQLite。响应只含：

- `statuses.commission / statuses.adoption` 的公开 tone、label、detail、href；
- 委托固定内容、业务邮箱和固定 `/about#terms` 入口；
- 关于页事实、制作范围、基本约定和工作室公开渠道；
- 联系页邮箱、QQ、抖音和防诈骗文字。

响应不含 `site_content.version`、营业状态版本、草稿标识、内部备注、私有 Key、签名 URL 或任何作品 `ownerContact`。`/commission`、`/about`、`/contact` 后续 SSR 页面应通过该公开 API 的 `useFetch`/等价请求读取，不把结果做跨请求共享缓存。

## 自动化

- `pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- `pnpm test`：14 文件 / 88 用例 PASS；
- `pnpm test:integration`：12 文件 / 93 用例 PASS；
- `pnpm build`：PASS，生产内容 guard 同步通过；
- 新 API 定向：8/8 PASS；数据库迁移/约束专项：13/13 与 9/9 PASS；公开站既有契约：5/5 PASS。

覆盖了独立状态更新、初建/更新版本冲突、邮箱/QQ/抖音、长度与 HTML/script 拒绝、空值/草稿、即时公开刷新、作品私有联系人泄漏、后台 Host/Origin/CSRF/no-store 和公开 Host 隔离。

## 前端开始前需用户确认的精确内容

公开页面可以先实现空值隐藏和草稿管理，但上线真实文案前仍需用户逐项登记：

1. 委托页短说明；
2. 人工估价说明；
3. 邮件行动说明；
4. 每一项委托 FAQ 的问题与回答；
5. 关于页工作室事实；
6. 关于页制作范围；
7. 基本约定完整纯文本；
8. 联系页防诈骗文字；
9. 委托当前 tone、公开标签与短说明；
10. 领养当前 tone、公开标签与短说明。

邮箱 `3114559925@qq.com`、QQ `3114559925`、抖音 `to3114559925` 已在上游文档登记，不属于待编造项。前端仍应让用户在现有首页管理入口核对最终显示，不新增主导航。
