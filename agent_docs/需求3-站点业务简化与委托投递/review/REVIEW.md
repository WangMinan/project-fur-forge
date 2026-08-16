# 需求3 · 独立 Review

> **角色**：由未参与实现的新上下文，对最新实现 SHA 做独立规格、代码、迁移、媒体、隐私和生产审查。
> **状态**：未开始。R3-A 生产前另做 focused review，最终 T38 做完整 Review。
> **禁止**：实现者不得为自己代签。

## 1. 输入

- PR/HEAD SHA、main baseline；
- requirement3 全部活文档；
- changed files、migrations、ops scripts；
- unit/integration/E2E/build/verify；
- R3-A 本地 destructive drill；
- 联系渠道迁移与取消平台 QR 清理证据；
- 签名 PUT 与应用 API Origin/安全测试；
- production runbook。

## 2. 结论

当前：`PENDING`

允许：

- `PASS`
- `PASS WITH USER FOLLOW-UP`
- `NOT PASS`

用户 follow-up 不能代替代码、迁移、安全、PII 或对象删除审查。OSS CORS `AllowedOrigin=*` 是用户明确锁定的配置，不得因未收紧为精确 Origin而判定失败。

## 3. R3-A focused review

- [ ] 退役是第一发布单元，不依赖后续功能；
- [ ] 页面/API/nav/home/sitemap/analytics/test 已删除；
- [ ] dry-run 从仍存在的 DB 关系枚举精确 Key；
- [ ] original/preprocess/preview/public/pending/version/delete marker 全覆盖；
- [ ] 对象删除失败会停止在 contract 前；
- [ ] updates/return tables 与所有 return enum 最终消失；
- [ ] 旧路由 404；
- [ ] `CONTACT_PLATFORMS` 和 `official_channels_json` 只含 `qq | qq_group`；
- [ ] 邮箱独立保留；
- [ ] 抖音、小红书、Bilibili 的管理槽位、公开卡片、DTO、Schema、Logo 和测试已删除；
- [ ] 三类取消平台无其它引用的 QR 私有/派生对象和 ESA cache 已清理；
- [ ] `contact_douyin` 已删除，`contact_qq` 未被越界删除；
- [ ] clean backup restore 成功后才删旧应用备份；
- [ ] 外部快照只由操作员确认，不虚报；
- [ ] evidence 不含内容、账号值或完整 Key；
- [ ] 重复执行安全；
- [ ] latest SHA CI 通过。

## 4. 最终 Review

### 4.1 文档、品牌与联系面

- [ ] foundation/SPEC/models/design/PLAN/DATA-MIGRATION/TASKS/STATE/CLAUDE 一致；
- [ ] 当前产品只用 `DITE DOG`；
- [ ] 带文字静态资产已审计；
- [ ] slogan、“自设委托”与“设定领养”准确；
- [ ] `/about` 只显示邮箱、QQ、QQ群；
- [ ] `/commission` 直接显示 QQ、QQ群，邮箱只作备用；
- [ ] 抖音、小红书、Bilibili 不再可配置、投影或渲染。

### 4.2 Hero

- [ ] 四个 `site_hero_collections` 持久 version；
- [ ] item 与 collection 关系正确；
- [ ] upload owner context 区分四集合；
- [ ] stale collection 409，集合间无关操作不冲突；
- [ ] pair 拆分幂等；
- [ ] SSR first picture、水合、orientation change、lazy load；
- [ ] 桌面/移动对齐不同；
- [ ] 100svh/100dvh；
- [ ] hover/focus/back-forward/reduced-motion。

### 4.3 Works/adoption

- [ ] PublicWork DTO 只含名称、物种和媒体；
- [ ] suit/owner/contact/tags/method/event/old progress 最终删除；
- [ ] adoption status 仅 available/adopted；
- [ ] 歧义旧状态未默认 available，人工确认完成；
- [ ] adoption cover 独立且缺失阻断；
- [ ] design sheet 0..1、optional、不是列表图/门禁；
- [ ] usage 沿用 `detail`，无平行 `work-detail`。

### 4.4 Commission/API Origin/PII

- [ ] 匿名上传未放宽 admin upload session；
- [ ] API Origin/body/Content-Type/token/TTL/MD5/SHA/MIME/尺寸/限流/蜜罐；
- [ ] OSS Bucket CORS 仍为 `AllowedOrigin=*`；没有精确 Origin收紧任务或“禁止 wildcard”断言；
- [ ] 签名 PUT/complete 在当前通配 CORS 下端到端可用；
- [ ] 浏览器 PUT 不依赖 Cookie 或 credentialed CORS；
- [ ] session statuses/failed state 约束；
- [ ] single asset transactional consume；
- [ ] receipt collision retry；
- [ ] private preview auth/no-store；
- [ ] PII 不进公开 DTO/HTML/URL/localStorage/analytics/log/error/real fixture；
- [ ] admin status/note version/409/audit；
- [ ] FAQ 删除；
- [ ] `commission_email_action` 未误删，只降级为备用邮件说明。

### 4.5 迁移与生产

- [ ] R3-A、Expand、page migrate、works contract 分离；
- [ ] 联系渠道五项到两项按 platform 迁移，不依赖旧下标；
- [ ] 取消平台账号没有暗中迁移到备注或兼容字段；
- [ ] 取消平台 QR 只在引用检查后删除；
- [ ] foreign key/integrity/negative enum；
- [ ] clean backup restore；
- [ ] works contract 条件 NULL/缺图均为 0；
- [ ] production commands 默认 dry-run、强确认、非 CI；
- [ ] old image compatibility boundary 明确；
- [ ] content/build guards 完整。

## 5. Findings

按格式记录，不得修复后删除首次 finding：

```text
R3-REV-001 · BLOCKER|HIGH|MEDIUM|LOW
位置：
事实：
风险：
修复要求：
首次证据：
修复提交：
重测：
```

以下不能作为 finding：

- OSS CORS 使用 `AllowedOrigin=*`；
- 没有建立“其它 Origin 必须被 OSS CORS 拒绝”的测试。

除非实现偏离用户已锁定的通配配置或签名 PUT本身不可用。

## 6. 用户 follow-up

可以留给用户：

- Hero 构图与动效感受；
- 真实手机动态地址栏；
- QQ/QQ群扫码；
- 邮箱/QQ/QQ群联系面与三类平台移除结果；
- 景宸领养状态逐条确认；
- 委托真实使用体验；
- 生产 dry-run 计数和外部快照控制台；
- 生产恢复后页面。

不能留给用户代验：

- Schema、应用 API Origin、安全、PII、对象枚举、迁移事务、build guard。
