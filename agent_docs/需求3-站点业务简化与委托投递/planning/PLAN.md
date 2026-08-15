# 需求3 · 实施计划

> **角色**：将需求3拆成可串行实施、可审查、可上线的发布单元。
> **状态**：计划锁定，应用代码尚未开始。
> **复查修订**：永久退役提前为第一发布单元；增加 Hero collection version、匿名上传 CORS、歧义状态人工复核；FAQ 与 email action 边界分开。

## 1. 总路线

```text
A 立即退役返图/动态
  → B Expand 新模型与安全
  → C 公开动效与 Hero
  → D 作品与领养
  → E 委托投递
  → F 全量 Review、用户验收与最终发布
```

所有数据库写、迁移、媒体删除和 operation 串行执行。R3-A 可以独立上线，不等待其它新功能。

## 2. 分支与提交

- 工程从最新 `origin/main` 建任务分支；
- 推荐每个阶段独立 PR；
- R3-A 清理代码、清理工具、退役迁移和生产手册必须属于同一可冻结发布；
- 本地结果、CI、独立 Review、用户验收和生产执行互不代签；
- 生产永久删除不在普通 CI 自动执行。

## 3. 阶段 A：立即永久退役

### A1. 品牌与入口基线

- 将英文名改为 `DITE DOG`；
- 更新 slogan；
- 审计 SEO、JSON-LD、测试和带文字的静态图片/SVG；
- 从公开/管理导航移除返图和动态；
- 首页停止查询/渲染 latest updates。

### A2. 退役代码

删除：

- public/admin pages；
- public/admin APIs；
- schemas/types；
- repositories/services/runners/recipes；
- upload/publication branches；
- fixtures/tests；
- sitemap/analytics route registration；
- production verify 中的旧入口。

### A3. 清理工具与数据库 contract

- dry-run 精确盘点；
- 强确认永久删除；
- 删除 return media、OSS versions/delete markers、ESA cache；
- drop updates/return tables；
- 重建 assets/upload/variants/publication/analytics 约束；
- 旧路由 404；
- 净化备份恢复验证后删除旧应用备份。

### A4. 本地演练、独立复查与生产

- 复杂本地副本完整演练；
- focused independent review；
- 最新 SHA CI；
- 用户核对生产 dry-run；
- 维护窗口执行；
- 生产恢复与脱敏记录。

### GATE-A

- 返图/动态代码、表、媒体和应用管理旧备份最终清空；
- 退役路由 404；
- clean backup restore pass；
- foreign key/integrity/production verify 通过；
- 外部快照状态由操作员明确记录。

## 4. 阶段 B：Expand

### B1. Hero collections/items

- 新建四个 collection 及 item 表；
- collection 作为独立 expectedVersion；
- 旧 pair 确定性拆分；
- 管理 upload owner context 区分四集合；
- linked work 删除；
- 复用现有 site-display、upscale、operation、lease、recovery、purge。

### B2. Works/adoption

- 新增 nullable adoption status；
- 仅自动映射 available/delivered；
- 歧义状态后台逐条复核；
- 新增 adoption cover、adoption-card；
- 旧字段暂留到页面切换完成。

### B3. Commission

- 新增 commission upload sessions/submissions；
- 新增 private media role；
- 独立限流、token、TTL、蜜罐、body/Origin；
- 私有 Bucket CORS 精确加入 public Origin；
- 管理 private preview 和审计。

### GATE-B

- 空库/既有库 expand、foreign key、integrity；
- Hero 拆分幂等和独立 409；
- adoption cover identity；
- commission upload state machine；
- CORS/preflight；
- PII leakage；
- 旧公开页面仍可用。

## 5. 阶段 C：公开动效与 Hero

### C1. 动效基础

- 导航 hover/focus 胶囊、阴影、轻微上移；
- 主内容 route transition；
- 首页区块 reveal 和卡片交互；
- Header/Footer 稳定；
- 无 JS 默认可见；
- reduced-motion 统一关闭。

### C2. Hero 公开端

- 删除 action/linked work；
- 桌面中文居中、英文/slogan 同行左右；
- 移动整体左对齐下移；
- 100svh/100dvh；
- landscape/portrait 独立序列；
- SSR first picture、水合、orientation change、懒加载；
- 10 秒轮播、暂停、页面隐藏、reduced-motion。

### C3. Hero 管理端

```text
首页大图 / 横版
首页大图 / 竖版
委托页大图 / 横版
委托页大图 / 竖版
```

各自新增、上传、排序、启停、预览、适配和发布；collection version、完整顺序、409 和 FLIP 保留。

### GATE-C

- 390/768/1023/1024/1440；
- 真实手机动态地址栏；
- 横竖数量/顺序不同；
- hydration 无警告；
- hover/focus/back-forward/error/reduced-motion；
- 首页业务标题为“委托与领养”。

## 6. 阶段 D：作品与领养

### D1. 管理表单

只维护名称、物种、内部 purpose、adoption status/price、精选和图片。删除 suit、owner、contact、tags、method、event、旧 progress UI。

媒体区：

- studio photo 主图/图集；
- adoption cover；
- optional design sheet。

### D2. Public works

- summary/detail DTO 收缩；
- `/works` 删除用途/装型筛选；
- `/works/{slug}` 删除 facts/tags/price/status；
- SEO/JSON-LD 收缩；
- 名称搜索/分页保留。

### D3. Adoption

- 景宸完成歧义状态确认；
- published adoption 补 cover 或下架；
- `/adoptions` 删除 method/count/event；
- cover only；
- 名称、物种、状态、可选价格。

### D4. Works contract

在页面/API完全切换、NULL status=0、缺图=0 后，重建表并删除旧列/tags。`commission_email_action` 和 contact 兼容列不受影响。

### GATE-D

- PublicWork DTO 无旧字段；
- adoption status NULL=0；
- published adoption missing cover=0；
- published work missing primary photo=0；
- works/detail/adoptions 三视口；
- contract migration/integrity 通过。

## 7. 阶段 E：委托投递

### E1. 公开上传/API

- create session；
- conditional PUT；
- complete；
- consume into submission；
- token/TTL/摘要/MIME/尺寸；
- CORS/Origin/限流/蜜罐；
- 失败、取消、过期和清理；
- no PUBLIC variant。

### E2. `/commission/apply`

- 单图；
- 五项文本/数值字段；
- 上传状态和预览；
- 邻近错误；
- 失败保留当前内存草稿；
- 过期重选；
- 成功回执；
- 不写 URL/localStorage/analytics/console。

### E3. `/admin/commissions`

- pending/accepted/rejected；
- 列表最小私有暴露；
- 详情；
- no-store preview；
- 状态/备注；
- version/409/audit。

### E4. `/commission` 与内容

- 站内提交为主 CTA；
- QQ/QQ群二维码；
- about 入口；
- 删除 FAQ UI/Schema/API/version/data；
- 保留 intro/estimate/email action；
- email action 不作为 commission 主 CTA；
- about/privacy 文案同步。

### GATE-E

- 上传/提交/重复/过期/限流/蜜罐/清理；
- 管理详情/状态/备注/409；
- CORS live probe；
- PII leakage；
- 真实浏览器端到端提交；
- FAQ 删除且 email action 未误删。

## 8. 阶段 F：最终门禁

- 全量 lint/typecheck/unit/integration/E2E/build/verify；
- production content guard；
- 新上下文独立 Review；
- 用户首页、Hero、works、adoption、commission、后台、真实手机验收；
- 部署 B–E 的冻结镜像；
- 回填 STATE、models、迁移、证据和生产事实。

## 9. 风险控制

| 风险 | 控制 |
| --- | --- |
| 退役拖延 | R3-A 独立第一发布单元。 |
| 媒体先删后失去 Key | 数据库仍在时枚举；失败停止在 contract 前。 |
| 旧备份提前删除 | clean backup restore 成功后才删旧应用备份。 |
| Hero 四集合互相冲突 | 独立 collection version 和 upload owner context。 |
| 歧义状态误标可领养 | 只自动映射明确值，其余人工确认。 |
| 公开上传浏览器失败 | 精确 CORS/preflight/live probe。 |
| PII 泄漏 | DTO 分层、日志禁值、no-store、负向测试。 |
| 动效影响可用性 | SSR 默认可见、短时、键盘、back-forward、reduced-motion。 |
