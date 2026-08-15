# CLAUDE.md

本文件是 `project-fur-forge` 编码 Agent 的稳定入口；`AGENTS.md` 指向本文件。临时 SHA、Actions run、一次性 finding 和任务进度必须写入 `agent_docs/`，不在此固化。

## 1. 项目与权威文档

项目为“有点小狗工作室”提供图片优先的公开站和轻量管理后台。英文品牌名固定为 `DITE DOG`，不得再使用 `DITE DOG FURSUIT`。

需求1继续提供双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。当前活跃产品增量是需求3。

开工前至少完整阅读：

### 需求1基线

- `agent_docs/需求1-兽装工作室主页/requirements/MEDIA-PUBLICATION-POLICY.md`
- `agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`
- 与任务直接相关的需求1 STATE/SPEC/PLAN/models

### 需求3活文档

1. `agent_docs/需求3-站点业务简化与委托投递/STATE.md`
2. `foundation/README.md`
3. `requirements/SPEC.md`
4. `models/README.md`
5. `.design/README.md`
6. `planning/PLAN.md`
7. `planning/DATA-MIGRATION.md`
8. `implementation/TASKS.md`
9. `implementation/EXECUTION_ROUTING.md`

需求2仍是二维码上传/公开派生和名称搜索的实现依据；其五平台列表、返图、FAQ、最新动态和其它旧产品行为已被需求3明确覆盖。当前官方联系方式只维护邮箱、QQ 和 QQ群。

权威顺序：SPEC 定产品契约；models 定目标模型；PLAN/DATA-MIGRATION 定顺序和停止点；TASKS 定勾选；STATE 定当前事实。聊天摘要、dated notes、旧 Review 和历史 commit 不能覆盖活文档。

## 2. 当前产品边界

### 2.1 品牌与首页

- 英文名：`DITE DOG`。
- slogan：`不只做小狗毛 | 只做海绵头`。
- 首页业务标题：`委托与领养`。
- Hero 删除 action/linked work。
- 桌面：中文居中，英文/slogan 同行左右。
- 移动：整组左对齐下移，至少覆盖 100svh/100dvh。
- 首页/委托×横/竖四个集合独立，集合级 version、排序、启停和上传归属互不干扰。
- 首页固定 10 秒轮播，保留暂停、hidden pause 和 reduced-motion。

### 2.2 第一阶段立即退役与联系渠道收缩

需求3第一发布单元必须永久删除：

- `/returns`、`/returns/{slug}`、`/updates` 及管理端/API/导航/首页摘要；
- `updates`、`return_characters`、`return_photos`；
- return assets、sessions、variants、operations、analytics；
- private originals/preprocess/preview、public variants、pending objects；
- OSS versions/delete markers（若启用）和 ESA cache；
- clean backup 验证后删除旧应用管理备份。

同一发布单元把官方渠道收缩为：

- 邮箱：独立保留；
- `qq`：保留账号和二维码；
- `qq_group`：保留账号和二维码；
- `douyin`、`xiaohongshu`、`bilibili`：从枚举、Schema、管理端、公开端和持久数据中移除；其失去引用的二维码资产按现有媒体清理规则删除。

不得把退役拖到 Hero、作品或委托完成后。外部 ECS/云盘快照必须由操作员确认，不能虚报。

### 2.3 Works/adoption

- 普通作品公开只含名称、物种和媒体。
- 删除 suit、owner、contact、tags、old progress、method、event。
- adoption status 仅 `available | adopted`。
- 旧 `available`/`delivered` 可自动映射；其它旧状态必须人工确认，禁止默认 available。
- published adoption 必须有独立横版 `adoption_cover` 和 primary `studio_photo`。
- `design_sheet` 0..1、可选，不作卡片或发布门禁。
- 媒体详情 usage 沿用现有 `detail`，不要新建平行 `work-detail`。

### 2.4 Commission

- `/commission/apply`：一张设定图、称呼、+86 手机、QQ、身高、体重。
- `/admin/commissions`：pending/accepted/rejected。
- 不接 SMTP、短信、公开查询、自动建作品。
- FAQ JSON/version/UI/API/test 全部删除。
- `commission_email_action` 保留为备用邮件说明，不作 `/commission` 主 CTA，不得顺手物理删除。
- 公开联系只展示邮箱、QQ 和 QQ群；不再维护抖音、小红书和 Bilibili。
- 匿名上传使用独立 `commission_upload_sessions`，状态沿用大写状态机惯例。
- 私有设定图无 PUBLIC variant、无 ESA、无水印。
- OSS Bucket CORS 继续保持当前 `AllowedOrigin=*`；不得把“收紧为精确 Origin”或“禁止 wildcard”作为实现、CI、验收或生产门禁。应用自己的匿名 API 仍必须校验请求 Origin、token、TTL、限流和蜜罐。
- PII 不进入公开 DTO、HTML、URL、localStorage、analytics、普通日志、错误或真实 fixture。

## 3. Git 与写入

默认所有代码、文档、Review 和修复通过任务分支与 PR 合入 main。只有用户对当前操作给出明确直接 main 授权时，才可按该次授权执行；不得把例外扩散到后续任务。

- 写前 fetch，核对 main/upstream SHA；
- 更新分支使用 rebase；
- 不 force push、不 hard reset、不覆盖用户改动；
- 写操作、迁移、媒体删除和门禁串行；
- 提交小而可审查；
- 最新 PR/commit CI 只代表对应 SHA；
- 实现、focused review、最终 independent review、用户验收、生产执行互不代签。

## 4. 命令与测试

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

指定 Playwright spec：

```powershell
pnpm exec playwright test tests/e2e/public-home.spec.ts
pnpm exec playwright test tests/e2e/admin-home.spec.ts tests/e2e/public-home.spec.ts
```

不要使用 `pnpm test:e2e -- <spec>` 造成意外全量。Vue 异步事件后等待用户可观察状态，不用固定 sleep。

按风险执行：

- 常规代码：lint/typecheck/相关 unit；
- Schema/API/migration/匿名上传：相关 integration；
- Nuxt route/runtime：production build；
- 媒体/发布/恢复/永久删除：完整相关套件；
- UI：E2E + 真实浏览器；
- R3-A 和最终发布：verify、content guard、independent review。

OSS CORS 的 `AllowedOrigin=*` 是已确认运维现状，不设置“必须改为精确 Origin”的测试。端到端上传仍需证明签名 PUT、对象校验和应用层 Origin 防护可用。

## 5. 浏览器与 Host

```powershell
pnpm db:migrate
pnpm dev --host 0.0.0.0 --port 3000
```

- 管理：`http://localhost:3000`
- 公开：`http://127.0.0.1:3000`
- 不混用 Host。
- 至少验证 390×844、768×1024、1023×900、1024×900、1440×900。
- 委托表单再验证真实手机动态地址栏、输入法、单图上传和提交。
- 检查焦点、键盘、reduced-motion、console/network、图片方向、decode、404 和布局偏移。

## 6. 媒体、安全与生产

- 私有源图与公开派生图分离；公开只消费 ESA HTTPS READY variants。
- 服务端 OSS Endpoint、浏览器上传地址、ESA 回源各自配置，不能混用。
- 条件 PUT 使用 `OSS_UPLOAD_BASE_URL`；服务端 SDK 使用 `OSS_ENDPOINT`。
- OSS CORS 继续使用通配 `*`；安全边界依赖私有 Bucket、短时条件 PUT、不可预测对象 Key、摘要校验和应用 API Origin 校验，而不是把 CORS 收紧作为发布条件。
- production 环境由 `APP_ENV` 判定。
- 下架立即移除公开查询并对精确 URL purge。
- `.env*`、runtime schema、tests、部署文档同步；不输出 Secret。
- app-only Compose，Nuxt/Nitro 绑定 `127.0.0.1:3000`；Nginx 在宿主机，ESA 终止 TLS。
- 正式 Host 精确隔离；原始 loopback Host 421 不得放宽。
- `/_nuxt/**` 可长缓存；API、管理、会话和写操作绕过共享缓存。

### 6.1 永久清理纪律

- 默认 dry-run；
- 停机和阻断写入；
- 脱敏计数与用户强确认；
- DB 关系仍在时枚举 Key；
- 对象/versions/cache 完整删除并验证；
- 失败停止在 DROP 前；
- database contract + integrity/readiness/verify；
- clean backup create/restore；
- 再删旧应用备份；
- 外部快照由操作员确认；
- 不保存内容、PII、完整 Key 或可恢复 manifest；
- contract 后只用目标 Schema 兼容的新镜像前向修复。

## 7. 代码组织

`server/utils/`：

| 目录 | 职责 |
| --- | --- |
| `repository/` | SQL、行映射、CAS、lease |
| `service/` | 同步规则、校验、DTO、事务入口 |
| `runner/` | 持久 operation、OSS 副作用、恢复、清理 |
| `recipe/` | 纯媒体身份、处理串、Key、尺寸 |
| `route/` | Host、Session、Origin、CSRF、body、错误 |

- Hero/works/adoption cover 复用 publication operation、lease、recovery、purge。
- 匿名委托可有独立会话表，但不能复制 OSS client、图片验证或错误体系。
- 公开内容 SSR 默认可见；动效不能先隐藏后等 JS。
- 管理列表、抽屉、对话框和上传 UI 优先复用现有组件。
- 不重写历史 migration，只新增前向 migration。
- `/licenses` 不进入 CMS。
- FFmpeg 许可证与实际分发保持同步。

## 8. 本地维护

- Hero 横版推荐至少 1920×1080，竖版至少 1080×1920；两个方向分别维护。
- adoption cover 必须是真实横版单头成果图，不自动裁切生成。
- 委托设定图只做私有验证。
- 普通运维写操作默认 dry-run。
- 正式部署/恢复以需求1生产手册、需求3 DATA-MIGRATION 和冻结发布记录为准。
