# 需求3 · 执行路由

> **角色**：规定需求3各类任务的实施顺序、角色边界、交接物和独立 Review 要求。
> **状态**：角色路由已锁定；具体使用哪个模型或长程 Agent 可在开工前由用户决定，不在稳定文档中写死。

## 1. 总顺序

严格按以下顺序推进：

```text
需求冻结
  → Expand 数据/媒体/安全基础
  → 公开动效与 Hero
  → 作品与领养
  → 委托投递
  → 本地永久清理与 Contract
  → 全量门禁
  → 新上下文独立 Review
  → 用户验收
  → 生产永久清理与迁移
```

前端不得在后端契约未稳定时自行发明字段；后端不得以“暂时兼容”为由偏离最终 SPEC。

## 2. 业务与后端实现角色

负责 TASKS 中：

- T02–T06；
- T11 的公开序列数据与 SSR 支撑；
- T14 的后端/Schema 部分；
- T17–T18 的媒体与迁移部分；
- T21–T22、T24 的 API/service/repository/security 部分；
- T27–T32；
- 对应 unit/integration、迁移、运维和生产守卫。

主要职责：

- Drizzle/SQLite 前向迁移；
- repository/service/runner/recipe/route 分层；
- OSS/ESA 媒体身份和 operation；
- 匿名上传信任边界；
- PII、Host、Origin、CSRF、限流和日志；
- 返图/动态不可恢复清理工具；
- production build、verify 和部署手册。

禁止：

- 在匿名上传中复用或放宽管理员 `upload_sessions` 的身份约束；
- 把私有委托字段写入审计正文、analytics、日志或测试真实数据；
- 先 DROP 返图表再尝试枚举 OSS Key；
- 自动生成 `adoption_cover`；
- 在普通 CI 中执行生产破坏性命令。

## 3. 公开与管理前端实现角色

负责 TASKS 中：

- T07–T10；
- T11 的轮播、hydration 和响应式部分；
- T12–T16 的前端部分；
- T19–T20 的公开页面；
- T23–T26 的页面、表单和管理体验；
- 对应组件测试、E2E、截图和三视口验证。

主要职责：

- 导航 hover/focus、页面切换、区块 reveal、卡片交互；
- 桌面/移动不同 Hero 排版；
- 横竖独立 Hero 管理；
- 简化作品和领养页面；
- 单图委托表单；
- 委托后台列表与详情；
- reduced-motion、键盘、焦点、滚动锁定、错误恢复和响应式。

禁止：

- 把旧字段留在界面中“暂时隐藏”；
- 在客户端拼装或缓存手机号、QQ 等私有数据；
- 通过 CSS 自动裁切竖版图来伪造领养横版头图；
- 为追求动效让 SSR/无 JavaScript 内容默认不可见；
- 复制一套新的管理列表、抽屉、上传器或错误组件。

## 4. 数据迁移与运维角色

T27–T32、T36 由熟悉数据库、OSS 和部署的业务实现角色串行负责，且必须满足：

- dry-run 默认；
- 强确认短语；
- 停机后执行；
- 精确对象枚举；
- OSS versioning 检查；
- ESA purge 追踪；
- DROP 前对象删除完整；
- integrity、foreign key、readiness、verify；
- 净化备份；
- 脱敏证据。

生产 T36 只能在用户明确维护窗口中执行。Agent 可以准备命令和检查表，但不能把“文档已写好”描述为生产删除完成。

## 5. 独立 Review

T34 必须由没有参与需求3实现的新上下文执行。Review 至少覆盖：

1. SPEC、PLAN、TASKS、models、design 是否一致；
2. 旧英文名是否完整回退；
3. 返图/动态是否真的删除而不是隐藏；
4. 数据和对象删除顺序是否安全；
5. 新作品 DTO 是否无法携带旧字段；
6. `adoption_cover` 是否是独立媒体；
7. 匿名上传是否没有放宽管理上传；
8. 委托 PII 是否存在日志、URL、analytics 或公开 DTO 泄漏；
9. Hero SSR/hydration/方向变化是否正确；
10. reduced-motion、键盘、Host 隔离和生产守卫是否完整；
11. 本地永久删除和重复执行证据是否可信；
12. contract 后旧镜像不可用的运维边界是否明确。

Review 结论只能是 `PASS`、`PASS WITH USER FOLLOW-UP` 或 `NOT PASS`，并记录首次 findings 与修复重测。

## 6. 用户验收

用户只需要签署真实产品行为，不代替代码 Review：

- 首页排版、首屏、横竖素材和动效；
- 作品、详情、领养图片与文字；
- 委托页、表单、QQ/QQ群二维码；
- 委托后台三状态和设定图查看；
- 真实手机和 reduced-motion；
- 返图/动态永久删除授权和生产 dry-run 计数；
- 生产恢复后的最终页面。

## 7. 分支建议

推荐按以下主题分支或 PR：

```text
feat/r3-expand-models
feat/r3-home-motion-hero
feat/r3-works-adoptions
feat/r3-commission-submissions
feat/r3-destructive-retirement
review/r3-independent-review
```

若一个长程 Agent 在单分支完成多阶段，也必须按 TASKS 顺序形成小提交和清楚 notes，不能把 migration、前端、删除工具和修复压成一个不可审查提交。

## 8. 每阶段交接物

每个实现阶段至少留下：

- 修改文件和契约摘要；
- 迁移/接口/组件清单；
- 精确测试命令和结果；
- 真实浏览器视口与截图/trace 路径；
- 已知限制和下一任务依赖；
- 不含 Secret、PII、真实图片内容和完整 Object Key 的 dated note。

未提供交接物的任务不能勾选完成。
