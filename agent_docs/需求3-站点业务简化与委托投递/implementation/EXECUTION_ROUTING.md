# 需求3 · 执行路由

> **角色**：规定阶段顺序、角色边界、交接物和独立 Review。
> **状态**：已按 2026-08-15 最新用户口径更新。

## 1. 总顺序

```text
A 立即退役返图/动态并收缩联系渠道
  → B Expand
  → C 动效与 Hero
  → D 作品与领养
  → E 委托投递
  → F 独立 Review、用户验收、最终发布
```

R3-A 是独立第一发布单元。不得为了“等新功能一起上线”继续保留返图、动态或已经取消的三类平台联系方式。

## 2. 后端/数据/安全角色

负责：

- T02–T14；
- T19 的 DTO/SSR 数据部分；
- T25、T29；
- T30–T31、T33 的 API/安全部分；
- T37 的后端门禁；
- 所有迁移、清理工具、OSS/ESA、联系渠道 contract 和生产手册。

必须：

- repository/service/runner/recipe/route 分层；
- 复用 publication lease/recovery/purge；
- Hero 使用 collection version；
- 匿名上传独立会话但复用底层图片验证；
- 公开 API 校验 Origin/token/TTL/限流，OSS 条件 PUT 校验摘要/MIME/尺寸；
- OSS Bucket CORS 保持用户确认的 `AllowedOrigin=*`，不新增精确 Origin 收紧门禁；
- 联系平台目标枚举固定为 `qq | qq_group`，邮箱独立；
- 三类取消平台的 JSON 项、读写分支和无其它引用二维码资产按迁移计划清理；
- 歧义领养状态不默认 available；
- 先枚举/删媒体，再 DROP 退役表；
- clean backup 验证后再删旧应用备份。

禁止：

- 复用或放宽管理员 upload session 身份边界；
- 把 PII 写入日志、审计正文、analytics 或 fixture；
- 先 DROP return 表再猜 Key；
- 自动生成 adoption cover；
- 在普通 CI 运行生产永久删除；
- 把 OSS CORS 收紧为 public/admin 精确 Origin，或把 wildcard 当作 finding；
- 继续接受/写入 `douyin | xiaohongshu | bilibili` 官方渠道；
- 删除 `commission_email_action` 或 `contact_qq` 兼容列；
- 让四个 Hero 集合继续共享一个 home version。

## 3. 前端角色

负责：

- T15–T24 的 UI；
- T27–T28；
- T32–T35 的页面；
- 对应组件测试、E2E、截图、真实手机和 reduced-motion。

必须：

- 复用公共导航、抽屉、焦点、列表和上传 UI；
- SSR/无 JS 默认可见；
- Hero 桌面/移动不同对齐；
- 首页、`/works`、`/adoptions` 作品卡统一显示“名称 · 物种”，点号两侧保留空格并复用名称字体/字号；
- adoption card 只用 cover，已领养状态使用非绿色中性色；
- 首页精选不得按 adopted 过滤；首页领养区只取 available；
- `/about` 只展示邮箱、QQ、QQ群；
- `/commission` 只直接展示 QQ、QQ群，邮箱作为备用入口；
- 委托表单不把 PII 写 URL/localStorage/console；
- 管理列表避免大面积暴露手机号/QQ。

禁止：

- 把旧字段只用 CSS 隐藏；
- 用 design sheet/studio photo 假装 cover；
- 继续渲染抖音、小红书、Bilibili 卡片或后台槽位；
- 复制第二套抽屉、管理表或错误组件；
- 为动效破坏 back/forward、焦点或 reduced-motion；
- 把邮件重新做成委托页主 CTA。

## 4. 第一发布单元运维角色

T03–T07 必须由熟悉 SQLite、OSS、ESA 和部署的人串行执行：

- 默认 dry-run；
- 停机；
- 脱敏计数；
- 强确认返图/动态不可恢复删除；
- 精确对象/版本枚举；
- 三类取消平台二维码引用和孤立资产枚举；
- ESA purge；
- 对象不可达验证；
- database/contact contract；
- clean backup create/restore；
- old app backup retirement；
- external snapshot operator check。

生产 T07 只在用户明确维护窗口执行。文档或脚本准备完成不等于生产删除完成。

## 5. 独立 Review

R3-A 在生产前做 focused review；最终 T38 做全需求 review。最终至少检查：

1. 退役是否已第一阶段真正完成；
2. 对象删除和 backup 顺序；
3. 官方渠道是否只剩邮箱、QQ、QQ群，三类取消平台及孤立 QR 是否清理；
4. Hero collection version/upload owner context；
5. SSR/hydration/orientation；
6. works DTO 与旧字段删除；
7. adoption 歧义状态人工确认；
8. adoption cover 独立；
9. commission API Origin/token/TTL/PII 与签名 PUT；
10. OSS CORS 是否保持 `*` 且未被错误设为门禁；
11. FAQ 删除但 email action 未误删；
12. reduced-motion、Host、CSRF、production guard；
13. migrations、integrity、clean backup；
14. 当前 SHA CI 和证据。

实现者不得代签自己的独立 Review。

## 6. 用户验收

用户签署：

- 生产 R3-A dry-run 计数和不可恢复删除；
- 邮箱、QQ、QQ群联系面与三类平台移除结果；
- 首页排版、首屏和动效；
- 横竖 Hero 管理；
- works/adoption 图片与文案；
- commission 表单/后台/QQ及QQ群二维码；
- 真实手机和 reduced-motion；
- 最终生产页面。

用户不代验 Schema、PII 泄漏、应用 API Origin/Host/CSRF、迁移事务或对象枚举。OSS CORS `*` 是用户已确认配置，不需要用户再次作为安全门禁验收。

## 7. 推荐分支

```text
feat/r3-retire-returns-updates
feat/r3-expand-models
feat/r3-home-motion-hero
feat/r3-works-adoptions
feat/r3-commission-submissions
review/r3-independent-review
```

一个长程 Agent 可以连续工作，但必须按 TASKS 形成小提交和 dated notes。

## 8. 每阶段交接

- TASK IDs、分支、SHA；
- 修改/未修改范围；
- migration/API/component 列表；
- 精确测试命令和首次/修复结果；
- 浏览器 Host、视口、trace；
- OSS/ESA、联系渠道清理、签名 PUT或 PII 证据；
- 下一依赖；
- 不含 Secret、PII、真实图片和完整 Key 的 note。
