# CLAUDE.md

本文件是 `project-fur-forge` 编码 Agent 的稳定入口；`AGENTS.md` 指向本文件。临时 SHA、Actions run、一次性 finding、截图和任务进度写入对应 `agent_docs/`，不在本文件固化。

## 1. 项目与权威文档

项目为“有点小狗工作室”提供图片优先的公开站和轻量管理后台。英文品牌固定为 `DITE DOG`，不得再使用 `DITE DOG FURSUIT` 或“暂用英文名”。

需求1继续提供双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。需求3提供当前已经实现的业务基线。**当前活跃产品增量是需求4：站点视觉升级与内容合规。**

开工前至少完整阅读：

### 需求1稳定基线

- `agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md`
- `agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`
- 与任务直接相关的需求1 STATE/SPEC/PLAN/models

### 需求3当前产品基线

- `agent_docs/需求3-站点业务简化与委托投递/STATE.md`
- `foundation/README.md`
- `requirements/SPEC.md`
- `models/README.md`
- `planning/DATA-MIGRATION.md`

### 需求4活文档

1. `agent_docs/需求4-站点视觉升级与内容合规/STATE.md`
2. `foundation/README.md`
3. `requirements/SPEC.md`
4. `requirements/COPY.md`
5. `models/README.md`
6. `.design/README.md`
7. `planning/PLAN.md`
8. `planning/DATA-MIGRATION.md`
9. `implementation/TASKS.md`
10. `review/REVIEW.md`

权威顺序：SPEC 定产品契约；COPY 定目标成文；models 定目标字段；design 定视觉行为；PLAN/DATA-MIGRATION 定顺序与停止点；TASKS 定勾选；STATE 定当前事实。聊天摘要、dated notes、旧 Review 和历史 commit 不能覆盖活文档。

## 2. 当前产品基线

### 2.1 品牌与退役边界

- 中文：`有点小狗工作室`；短品牌：`有点小狗`。
- 英文：`DITE DOG`。
- slogan：`不只做小狗毛 | 只做海绵头`。
- 返图墙、最新动态、FAQ、抖音、小红书和 Bilibili 已退役，不得为视觉改版恢复入口、表、DTO、媒体或占位。
- 当前官方联系面只有邮箱、QQ、QQ群。

### 2.2 Hero、作品和领养

- 首页/委托 × 横/竖四个 Hero 集合独立。
- 首页每方向 1–5 张、10 秒轮播、暂停、页面隐藏暂停、reduced-motion 停止。
- 委托每方向同时只启用一张，可以先下架再替换，不轮播。
- 普通作品公开只含名称、物种和媒体。
- adoption status 只有 `available | adopted`。
- published adoption 至少有合格 `adoption_cover` 或 `design_sheet`；卡片/首页按现行回落规则。
- adopted 可以进入精选，不进入首页当前领养。
- 作品详情保持名称、物种和单一查看序列；不恢复事实表、related、前后导航。
- 水印、publication operation、lease、recovery、purge 和媒体配方沿用现有实现。

### 2.3 委托

- `/commission/apply`：一张私有设定图、称呼、物种、+86 手机、QQ、身高、体重。
- 同一手机号已有 pending 时拒绝重复提交。
- `/admin/commissions`：pending/accepted/rejected。
- 不接 SMTP、短信、公开查询、自动建作品、在线合同、订单或支付。
- 私有设定图无 PUBLIC variant、无 ESA、无水印。
- PII 不进入公开 DTO、HTML、URL、localStorage、analytics、普通日志、错误或真实 fixture。

## 3. 需求4新增边界

### 3.1 首页与设计

- 首页固定四幕：品牌 Hero → 代表作品 → 自设委托 → 设定领养。
- 首页仍是完整业务地图，但各幕面积和视觉权重不等；不得退化为同权卡片平铺。
- PC Web 是第一视觉基准；390/430 移动端必须同步等价重排。
- 不使用 scroll-jacking、长时间 pinned scroll、强制横向叙事、持续视差、全屏粒子或背景音效。
- 动效只表达即时反馈、阅读方向、媒体序列和对象连续性。
- 普通页面动效使用 CSS/WAAPI 和统一 token；Apple Design Skill 是原则来源，不是安装 spring 库的命令。
- View Transitions 只做渐进增强，不支持或 reduced-motion 时自然回退。
- Header 材料最多一层；不堆叠玻璃或动画全屏 blur/filter。
- SSR/无 JavaScript 内容默认可见。

### 3.2 Hero 焦点

- 复用 `assets.focal_x/focal_y` 和现有 recipe identity/gravity。
- 后台首版只提供九宫格预设；默认中心。
- 只允许未启用 Hero item 修改焦点；已启用项走下架/替换和重新发布。
- 不新增自由裁切器、缩放滑杆、AI 主体识别或每断点独立 crop。
- 如果同一 asset 被多个 item 复用且需要不同焦点，阻断并登记，不静默覆盖。

### 3.3 联系与申请确认

- 站内表单负责结构化投递。
- 工作室官方 QQ 私聊负责优先后续沟通、报价和逐单确认。
- 邮箱是备用联系和隐私权利请求渠道。
- QQ群用于社群/一般交流，不是默认订单确认渠道。
- 新申请必须分别确认：
  - 已满 18 周岁并有权提交设定；
  - 已阅读当前隐私政策；
  - 理解提交不等于接单、报价、排期或合同。
- checkbox 不得预勾选；服务端校验 literal true 和版本。
- 历史申请保持 legacy/NULL，不伪造确认；新代码显式写 v2，最终 contract 默认收口为 v2。
- 不收身份证、出生日期、人脸或监护人信息。

### 3.4 保存与删除

- 委托 PII/私有设定图只在评估、履行、1 年保修、争议及法律必要期限内保存。
- 失效上传至少每月人工清理；申请至少每半年复核；rejected 处理满 180 天进入候选。
- accepted 只有业务/保修/争议/法定期限结束后，才由人工显式确认删除。
- 不建设 cron、Worker、TTL 或通用生命周期引擎。
- 必须建设受控 CLI：默认 dry-run、脱敏计数、强确认、DB/OSS 一体删除、验证、幂等重入。
- accepted 不允许仅凭日期批量删除；pending 只能列出复核。
- 用户删除请求单独处理，不等待周期批次。
- 删除/清理串行，不用手工 SQL 或 OSS 控制台替代完整工具。

### 3.5 服务条款和第三方声明

- 网站服务条款是一般规则；具体范围、价格、付款、排期、修改、交付和特殊约定在官方 QQ 中逐单书面确认。
- 条款不得以“所有解释权归工作室”或不合理单方免责兜底。
- 客户角色设定、实体所有权、工作室版型/工艺/照片、合理维修和商业复刻边界按需求4 COPY。
- npm 生产依赖声明从实际 lockfile/安装结果确定性生成。
- FFmpeg 当前只在自有服务器容器内使用，不对外分发。
- Noto Serif SC 按 SIL OFL 1.1。
- `zhuohei-collage.ttf` 来源为 Lemi Font 免费商用声明，作为第三方授权资产，不称为开源软件。
- 不新增 GitHub required check 或独立重型 workflow。

## 4. Git 与写入

默认所有代码、文档、Review 和修复通过任务分支与 PR 合入 main。只有用户对当前操作给出明确直接 main 授权时，才可按该次授权执行。

- 写前 fetch，核对 main/upstream SHA；
- 不 force push、不 hard reset、不覆盖用户改动；
- 写操作、迁移、媒体删除和门禁串行；
- 提交小而可审查；用户要求一个 commit 时必须使用原子 tree/commit，而不是逐文件产生多次提交；
- 最新 PR/commit CI 只代表对应 SHA；
- 实现、focused review、最终 independent review、用户验收和生产执行互不代签；
- 当前 main 不配置 required checks，不擅自改变。

## 5. 命令与测试

版本以 manifest/lockfile 为准：

```powershell
pnpm install --frozen-lockfile
$env:APP_ENV='test'; pnpm lint
$env:APP_ENV='test'; pnpm typecheck
$env:APP_ENV='test'; pnpm test
$env:APP_ENV='test'; pnpm test:integration
$env:APP_ENV='production'; pnpm build
pnpm run verify:production
```

E2E：

```powershell
pnpm exec playwright test tests/e2e/public-home.spec.ts
pnpm exec playwright test tests/e2e/admin-home.spec.ts tests/e2e/public-home.spec.ts
pnpm test:e2e
```

不要用错误参数导致意外全量或漏跑。Vue 异步事件后等待用户可观察状态，不用固定 sleep。

按风险执行：

- 文档：链接/占位/交叉口径 Review；
- 常规代码：lint/typecheck/相关 unit；
- Schema/API/migration/匿名上传：相关 integration + fresh/既有库/重入；
- Nuxt route/runtime：production build；
- 媒体/发布/恢复/删除：完整相关套件；
- 公开 UI 结构：完整 E2E + 真实浏览器；
- 需求4最终：verify、content/secret scan、PII leakage、notices drift、independent review。

## 6. 浏览器与 Host

```powershell
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理：`http://localhost:3000`
- 公开：`http://127.0.0.1:3000`
- 不混用 Host。
- 至少验证：390×844、430×932、768×1024、1023×900、1024×900、1440×900。
- 至少一台真实手机验证动态地址栏、safe area、输入法、触控、图片、确认和提交。
- 检查键盘、焦点、reduced-motion/transparency/contrast、console/network、decode、404、LCP/CLS 和水平溢出。

## 7. 媒体、安全与生产

- 私有源图与公开派生分离；公开只消费 ESA HTTPS READY variants。
- 服务端 OSS Endpoint、浏览器上传地址和 ESA 回源配置不能混用。
- 条件 PUT 使用 `OSS_UPLOAD_BASE_URL`；服务端 SDK 使用 `OSS_ENDPOINT`。
- OSS CORS 保持 `AllowedOrigin=*`；应用匿名 API 仍严格校验 Origin、token、TTL、限流、蜜罐、摘要、MIME、尺寸和图片解码。
- production 环境由 `APP_ENV` 判定。
- 下架立即移除公开查询并对精确 URL purge。
- `.env*`、runtime schema、tests 和部署文档同步；不输出 Secret。
- app-only Compose，Nuxt/Nitro 绑定 `127.0.0.1:3000`；Nginx 在宿主机，ESA 终止 TLS。
- 正式 Host 精确隔离；原始 loopback Host 421 不得放宽。
- `/_nuxt/**` 可长缓存；API、管理、会话和写操作绕过共享缓存。
- 不重写历史 migration，只新增前向 migration。
- 长 operation 保持 lease/heartbeat/recovery；不在请求中假装同步完成。
- 删除默认 dry-run、强确认、精确 Key、对象验证、数据库完整性和 clean backup 边界。
- 外部 ECS/云盘快照由操作员确认，Agent 不代签。

## 8. 代码组织

`server/utils/`：

| 目录 | 职责 |
| --- | --- |
| `repository/` | SQL、行映射、CAS、lease |
| `service/` | 同步规则、校验、DTO、事务入口 |
| `runner/` | 持久 operation、OSS 副作用、恢复、清理 |
| `recipe/` | 纯媒体身份、处理串、Key、尺寸 |
| `route/` | Host、Session、Origin、CSRF、body、错误 |

- 首页继续消费单个聚合 DTO，不为四幕复制请求或新增版式表。
- Hero/works/adoption 复用现有 publication/lease/recovery/purge。
- retention/deletion CLI 复用 repository/service/storage，不复制 OSS 客户端。
- 公开内容 SSR 默认可见；动效不能先隐藏后等 JS。
- 管理列表、对话框、上传和分页优先复用现有组件。
- `/licenses` 不进入 CMS；生成声明与人工资产 registry 是事实来源。
- 生产启用申请前必须配置真实个人信息处理者名称和邮箱。
