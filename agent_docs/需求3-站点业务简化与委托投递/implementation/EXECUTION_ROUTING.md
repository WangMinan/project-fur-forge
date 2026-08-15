# 需求3 · 执行路由

> **角色**：规定阶段顺序、角色边界、交接物和独立 Review。
> **状态**：已按 2026-08-15 文档复查更新。

## 1. 总顺序

```text
A 立即退役返图/动态
  → B Expand
  → C 动效与 Hero
  → D 作品与领养
  → E 委托投递
  → F 独立 Review、用户验收、最终发布
```

R3-A 是独立第一发布单元。不得为了“等新功能一起上线”继续保留返图和动态数据。

## 2. 后端/数据/安全角色

负责：

- T02–T14；
- T19 的 DTO/SSR 数据部分；
- T25、T29；
- T30–T31、T33 的 API/安全部分；
- T37 的后端门禁；
- 所有迁移、清理工具、OSS/ESA、CORS 和生产手册。

必须：

- repository/service/runner/recipe/route 分层；
- 复用 publication lease/recovery/purge；
- Hero 使用 collection version；
- 匿名上传独立会话但复用底层图片验证；
- CORS 精确 Origin；
- 歧义领养状态不默认 available；
- 先枚举/删媒体，再 DROP 退役表；
- clean backup 验证后再删旧应用备份。

禁止：

- 复用或放宽管理员 upload session 身份边界；
- 把 PII 写入日志、审计正文、analytics 或 fixture；
- 先 DROP return 表再猜 Key；
- 自动生成 adoption cover；
- 在普通 CI 运行生产永久删除；
- 删除 `commission_email_action` 或 contact 兼容列；
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
- 作品卡只显示名称/物种；
- adoption card 只用 cover；
- 委托表单不把 PII 写 URL/localStorage/console；
- 管理列表避免大面积暴露手机号/QQ。

禁止：

- 把旧字段只用 CSS 隐藏；
- 用 design sheet/studio photo 假装 cover；
- 复制第二套抽屉、管理表或错误组件；
- 为动效破坏 back/forward、焦点或 reduced-motion；
- 把邮件重新做成委托页主 CTA。

## 4. 退役运维角色

T03–T07 必须由熟悉 SQLite、OSS、ESA 和部署的人串行执行：

- 默认 dry-run；
- 停机；
- 脱敏计数；
- 强确认；
- 精确对象/版本枚举；
- ESA purge；
- 对象不可达验证；
- database contract；
- clean backup create/restore；
- old app backup retirement；
- external snapshot operator check。

生产 T07 只在用户明确维护窗口执行。文档或脚本准备完成不等于生产删除完成。

## 5. 独立 Review

R3-A 在生产前做 focused review；最终 T38 做全需求 review。最终至少检查：

1. 退役是否已第一阶段真正完成；
2. 对象删除和 backup 顺序；
3. Hero collection version/upload owner context；
4. SSR/hydration/orientation；
5. works DTO 与旧字段删除；
6. adoption 歧义状态人工确认；
7. adoption cover 独立；
8. commission CORS/Origin/token/TTL/PII；
9. FAQ 删除但 email action 未误删；
10. reduced-motion、Host、CSRF、production guard；
11. migrations、integrity、clean backup；
12. 当前 SHA CI 和证据。

实现者不得代签自己的独立 Review。

## 6. 用户验收

用户签署：

- 生产 R3-A dry-run 计数和不可恢复删除；
- 首页排版、首屏和动效；
- 横竖 Hero 管理；
- works/adoption 图片与文案；
- commission 表单/后台/二维码；
- 真实手机和 reduced-motion；
- 最终生产页面。

用户不代验 Schema、PII 泄漏、CORS、Host/CSRF、迁移事务或对象枚举。

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
- CORS/OSS/ESA 或 PII 证据；
- 下一依赖；
- 不含 Secret、PII、真实图片和完整 Key 的 note。
