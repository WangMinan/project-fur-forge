# 需求3 · 独立 Review

> **角色**：由未参与需求3实现的新上下文，对最新实现 SHA 做独立规格、代码、迁移、隐私、媒体和生产边界审查。
> **状态**：未开始。
> **禁止**：实现者不得为自己的实现代签；文档创建不等于 Review 完成。

## 1. Review 输入

Review 开始前必须记录：

- PR 与最终 HEAD SHA；
- `main` 基线 SHA；
- 所有需求3文档；
- changed files 和迁移列表；
- 相关 unit/integration/E2E/build/verify 结果；
- 本地永久清理演练的脱敏证据；
- 生产维护手册草案。

## 2. 结论

当前结论：`PENDING`

允许的最终结论：

- `PASS`；
- `PASS WITH USER FOLLOW-UP`；
- `NOT PASS`。

`PASS WITH USER FOLLOW-UP` 只适用于必须由用户在真实手机、真实内容或生产控制台验证的项目，不能用来绕过代码、迁移、安全或隐私 finding。

## 3. 必查清单

### 3.1 文档一致性

- [ ] Foundation、SPEC、models、design、PLAN、DATA-MIGRATION、TASKS、STATE、CLAUDE 一致；
- [ ] 所有开放问题已答；
- [ ] 任务勾选和证据不互相代签；
- [ ] 旧需求只在明确条款上被覆盖，安全/媒体/部署基线未被暗中放宽。

### 3.2 品牌与公开内容

- [ ] 当前代码、SEO、JSON-LD、测试和可见内容只使用 `DITE DOG`；
- [ ] 首页 slogan 精确为 `不只做小狗毛 | 只做海绵头`；
- [ ] “委托与领养”标题和委托主行动正确；
- [ ] 公开/管理导航没有返图和动态入口。

### 3.3 返图与动态永久退役

- [ ] 页面、API、Schema、repository、service、runner、recipe、fixture 和测试已删除；
- [ ] `updates`、`return_characters`、`return_photos` 不存在；
- [ ] `return_photo`、`return-wall`、`return-display-v1`、`RETURN_PHOTO` 不可插入；
- [ ] 私有原图、preprocess、preview、public variant、pending upload、OSS versions 和 ESA cache 已纳入清理；
- [ ] 旧数据库备份已删除并生成净化备份；
- [ ] 清理证据不包含内容或完整 Key；
- [ ] 重复执行安全，DROP 前失败会停止。

### 3.4 Hero 与动效

- [ ] 横竖记录、顺序、启停和发布完全独立；
- [ ] 首页和委托页每个方向至少一张；
- [ ] SSR 第一帧、水合、方向变化和懒加载无错误；
- [ ] 桌面和移动 Hero 对齐方式不同且符合设计；
- [ ] 移动首屏无白块；
- [ ] Header/Footer 在路由切换中稳定；
- [ ] hover/focus、键盘和 reduced-motion 完整。

### 3.5 作品与领养

- [ ] 持久模型不再维护 suit、owner、contact、tags、method、event 和旧 progress；
- [ ] PublicWork DTO 只含名称、物种和媒体；
- [ ] `/works` 和详情不显示旧字段；
- [ ] adoption 只有 `available | adopted`；
- [ ] `/adoptions` 没有 method 筛选；
- [ ] `adoption_cover` 独立于 studio photo 和 design sheet；
- [ ] 缺 cover 的 adoption 不能发布；
- [ ] 设定图最多一张且不是列表封面/发布门禁。

### 3.6 委托与隐私

- [ ] 匿名上传没有复用或放宽管理员 upload session；
- [ ] Origin、body、Content-Type、token、TTL、摘要、MIME、尺寸、限流、蜜罐和一次性消费完整；
- [ ] 一次申请只绑定一张 READY 私有设定图；
- [ ] 手机号、QQ、称呼、身高、体重、备注和图片不进入公开 DTO、HTML、URL、analytics、普通日志或错误；
- [ ] 管理预览认证、短时、no-store；
- [ ] 管理状态和备注使用 expectedVersion 与审计；
- [ ] 不发送邮件、不提供公开查询、不自动建作品；
- [ ] FAQ 与 `commission_email_action` 完整删除。

### 3.7 数据迁移与生产

- [ ] Expand、backfill、cleanup、contract 顺序正确；
- [ ] Hero 拆分幂等；
- [ ] 状态映射计数已人工复核；
- [ ] published adoption cover 和 primary studio photo 数量满足门禁；
- [ ] foreign key、integrity 和负向枚举测试通过；
- [ ] contract 后旧镜像不可用边界写明；
- [ ] 生产命令默认 dry-run、需要强确认，不由 CI 自动执行；
- [ ] 停止点、净化备份和前向修复路径明确。

## 4. 首次 findings

尚未执行。Review 时按严重度记录：

```text
R3-REV-001 · BLOCKER | HIGH | MEDIUM | LOW
位置：
事实：
风险：
修复要求：
首次证据：
```

不得在修复后删除首次 finding；追加状态和重测结果。

## 5. 修复重测

尚未执行。每条 finding 回填：

- 修复提交；
- 变更摘要；
- 精确重测命令；
- 重测结果；
- 是否需要全量回归或用户 follow-up。

## 6. 用户 follow-up

独立 Review 可以把以下项目留给用户：

- 真实手机动态地址栏和构图感受；
- 景宸对横版单头图和首页排版的视觉确认；
- QQ/QQ群二维码真实扫码；
- 真实委托字段和后台操作体验；
- 生产 dry-run 计数核对和强确认；
- 生产恢复后的最终页面。

不能留给用户代验：Schema、API、数据删除完整性、PII 泄漏、Host/Origin/CSRF、迁移事务、OSS 对象枚举或 production guard。

## 7. 最终签署

```text
Reviewed SHA:
Reviewer context:
First review result:
Final result:
Open user follow-ups:
Signed at:
```
