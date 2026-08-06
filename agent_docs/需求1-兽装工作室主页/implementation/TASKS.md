# 任务清单：兽装工作室主页

> **角色**：当前唯一可勾选实施分解。
> **最后校准**：2026-08-06。
> **规则**：历史工程事实保留；任务只有在当前完成定义全部满足后才能勾选。实现者不能代签用户验收。

## 当前目标

阶段 C 功能主链已经建立，当前只执行 **阶段 C.1 · P0 收口修复**。完成 T34-F1–T34-F8 并通过 `GATE-C1` 后，才能进入 T35。

媒体规则以 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源。当前 finding 见 [`../review/REVIEW.md`](../review/REVIEW.md)。

## 执行规则

- 写入前读取远端最新 `main`；
- 不 force push、不硬 reset、不删除或清空 `.env`；
- 数据库、Schema、API、媒体、可靠性和 UI 按依赖串行修改；
- 所有长任务必须有服务端持久状态、失败和恢复；
- UI、媒体和公开投影必须做真实浏览器、三视口、console/network 与图片解码检查；
- 本轮不在本地构建或运行 Docker；镜像只由 GitHub Actions 验证；
- 正式域名、TLS、线上 Compose、升级、回滚和恢复演练延期到部署阶段；
- dated notes 只记录证据，不覆盖当前 SPEC、STATE、PLAN 或 TASKS。

## 门禁状态

- [x] **GATE-01 · 需求与计划收敛**。
- [x] **GATE-02 · 技术主线锁定**：Nuxt 4、Node 24、Nitro、SQLite/Drizzle、双 Bucket、单实例。
- [x] **GATE-03 · 生产设计输入建立**。
- [x] **GATE-04 · 原型边界锁定**。
- [x] **GATE-05 · 实施授权**。
- [x] **EXT-01 · 正式素材登记**。
- [x] **EXT-02 · 双 Bucket 与 30 MB 媒体预检**。
- [x] **GATE-06 · 唯一管理员认证接线**。
- [x] **GATE-07 · 可配置活动水印 profile**：作为作品保护能力保持有效。
- [ ] **GATE-C1 · P0 收口总门禁**：依赖 T34-F1–T34-F8。

## A. 设计与工程底座

- [x] **T01 · 双访问面最小切片**。
- [x] **T02 · 运行配置、Host 与安全日志工具**。
- [x] **T03 · 共享契约与错误语义初版**。
- [x] **T04 · 公开站设计系统与导航壳**。
- [x] **T05 · 首页生产视觉样张**。
- [x] **T06 · 作品列表与详情视觉样张**。
- [x] **T07 · 管理端作品工作台视觉样张**。
- [x] **T08 · 生产视觉方向门禁**。
- [x] **T09 · 契约与基础代码审查修复**。

## B. 第一件作品垂直切片

- [x] **T10 · 双 Bucket 可行性预检与最小权限**。
- [x] **T11 · SQLite 运行底座与迁移框架**。
- [x] **T12 · P0 Schema、媒体角色与公开投影**。
- [x] **T13 · 唯一管理员认证**。
- [x] **T14 · 角色化私有原图条件直传**。
- [x] **T15 · 上传完成校验与用途预览**。
- [x] **T16 · 公开衍生图与历史水印配方**。
- [x] **T17 · 最小作品创建与编辑**。
- [x] **T18 · 发布与下架操作**。
- [x] **T19 · 作品详情 SSR**。
- [x] **T20 · 首页轮播、作品列表与真实公开投影**。
- [x] **T21 · 第一件作品垂直切片门禁**。

## C. 阶段 C 功能主链

- [x] **T22 · 完整作品字段、用途、装型、排序、精选、价格与短属性**。
- [x] **T23 · 设定图与出厂照角色化关系、发布约束和按需派生**。
- [x] **T24 · 管理端媒体分区、预览、上传恢复和媒体摘要**。
- [x] **T25 · 常规领养列表与统一详情媒体分区**。
- [x] **T26 · 委托固定文案、人工估价和邮件行动**。
- [ ] **T26-F1 · 委托页独立 Hero 与低分辨率适配**：历史工程与独立 Review 已完成，最终业务验收并入 T34-F8。
- [x] **T27 · 关于、官方渠道和独立营业状态**。
- [ ] **T27-F1 · 公开信息架构、政策页和导航增量**：历史工程与独立 Review 已完成，最终业务验收并入 T34-F8。
- [x] **T28 · 首页完整内容顺序**。
- [x] **T29 · 作品筛选、详情导航与兼容重定向**。
- [ ] **T30 · SEO、Sitemap 与品牌图标**：工程 Review 已完成，图标与页面视觉验收并入 T34-F8。
- [x] **T31 · 备份、验证恢复与迁移冒烟**。
- [x] **T32 · P0 安全门禁**：历史门禁保持有效，限流与代理边界由 T34-F5/F6 加固。
- [x] **T33 · 性能与三视口媒体回归**：历史结果保持有效，新媒体与视觉契约需在 T34-F8 重放。
- [ ] **T34 · 原 P0 全链与最小镜像**：历史工程与独立 Review 为 `PASS`，当前上线结论由 C.1 门禁取代。

## C.1 P0 收口修复

- [x] **T34-F0 · Review 结论与文档收敛**：
  - 确认站点展示位无水印、作品展示位保留水印；
  - 登记视觉、架构、可靠性、部署和 CI 必须项；
  - 建立唯一媒体事实源；
  - dated notes 保留历史事实。

- [x] **T34-F1 · 站点无水印媒体契约、既有数据迁移与真实验证**：
  - [x] `none | watermark` 保护模式和迁移 0017；
  - [x] 首页 Hero、委托 Hero 与首页两个入口的 `site-display-v1` usage；
  - [x] profile 应用排除无水印变体；
  - [x] 持久、幂等的 `media:reconcile-site-display`（迁移 0021 + 容器子命令）；
  - [x] 为当前已启用 Hero、委托 Hero 和既有已发布常规领养补齐变体；
  - [x] 验证失败重试、精确清理和旧投影持续可用；
  - [x] 真实双 Bucket 验证匿名公开读取、私有原图拒绝和 profile 切换不改变站点 URL/摘要（9/9 通过）。
  _依赖：T34-F0。_

- [x] **T34-F2 · 首页业务入口与详情竖图收口**：
  - [x] 统一业务入口卡替换“入口区 + 独立状态区”；
  - [x] 首页聚合投影和非关键区块故障隔离；
  - [x] 详情图集按方向布局，竖图限宽且索引复位；
  - [x] 代码顺序与公开站 IA 统一（Hero → 精选作品 → 统一业务入口 → 当前领养）；
  - [x] 在 390×844、768×1024、1440×900 重放视觉、键盘、焦点、解码和无横向溢出。
  _依赖：T34-F1 的契约。_

- [x] **T34-F3 · 文案 Card 与分区并发收口**：
  - [x] 六个文案 Card、六个分区版本、局部 API；
  - [x] FAQ 稳定 ID；
  - [x] 同分区 409 保留草稿，不整包覆盖；
  - [x] 邮箱、QQ、抖音和防诈骗说明统一在同一个可编辑官方渠道 Card；
  - [x] 两个管理上下文重放同分区/不同分区并发与重载。
  _依赖：T34-F2。_

- [x] **T34-F4 · 服务、组件和错误契约减债**：
  - [x] API 稳定业务 `reason`；
  - [x] 前端英文错误 message 匹配清零；
  - [x] `useHeroPreview` 与 `usePublicationPolling` 初步拆分；
  - [x] 拆分 Hero repository/service/publication runner；
  - [x] 拆分作品 publication runner；
  - [x] 拆分水印 profile service/apply runner；
  - [x] 拆分媒体配方、生成器与公开投影 repository（配方层 SQL 归零）；
  - [x] `server/utils` 按 repository/service/runner/recipe/route 分目录；
  - [x] 经引用、typecheck、build 和测试确认后删除重复定义；
  - [x] 重构前后 API、SQL、公开 DTO、状态机和浏览器行为一致。
  _依赖：T34-F3。_

- [x] **T34-F5 · 长任务恢复、上传清扫与限流加固**：
  - [x] 过期上传清扫、默认 dry-run、精确 Object Key 和幂等；
  - [x] 登录/管理写/匿名探测按主体分桶；
  - [x] 默认不信任转发头，只有可信代理网段可解析；
  - [x] publication/watermark operation 增加 attempt、lease、heartbeat、超时和 recovery reason（迁移 0020）；
  - [x] 事务内抢占 lease，OSS 副作用前后更新心跳；
  - [x] 应用启动扫描非终止任务并安全续做或转为可恢复失败（插件 02）；
  - [x] 生成、验证、提交边界真实杀 Node 进程并重启（子进程 SIGKILL）；
  - [x] 重复重启幂等，运行态任务不再永久阻塞新操作。
  _依赖：T34-F4。_

- [ ] **T34-F6 · Node 24 镜像、Docker Compose、Nginx 与健康检查**（**配置已修订，镜像构建通过**）：
  - [x] 标准 Node 24 多阶段 Dockerfile；
  - [x] pnpm 官方 production deploy，不手工复制单包依赖树；
  - [x] Docker 依赖阶段复制并执行版本控制内的 `allowBuilds` / `strictDepBuilds`；
  - [x] 显式选择 `project-fur-paws` workspace package，并把 deploy 输出隔离到 `/app/runtime-deploy`；
  - [x] 同一镜像提供 migrate、init-admin、backup、restore、preflight、cleanup；
  - [x] Compose 文件统一为 `docker-compose.yaml`；
  - [x] app 使用独立 egress 网络访问 OSS，仍不发布宿主机端口；
  - [x] Nginx 双 Host、未知 Host 拒绝、健康端点不对公网暴露；
  - [x] live/ready 接口已经存在；
  - [x] GitHub Actions `image-build` 在 `3b384c5` 成功；
  - [x] readiness 复用严格迁移历史/hash 校验（数量、顺序、folderMillis、hash）；
  - [x] 旧 `/api/health` 不再固定返回 ok，未就绪返回 503；
  - [ ] `checks` 修复后，GitHub Actions `docker compose -f docker-compose.yaml config --quiet` 成功；
  - [x] 本轮不做本地 Docker/Compose、正式域名或 TLS 验收。
  _依赖：T34-F5；配置文件可先准备，任务完成仍依赖业务与完整 CI。_

- [ ] **T34-F7 · GitHub Actions 与镜像发布流水线**（**工作流已修订，等待全绿**）：
  - [x] Action 升级到 2026-08-06 已核验的稳定版本；
  - [x] 使用 `pnpm/setup` 后继 Action；
  - [x] Compose 静态检查使用安全 dummy 环境，不 source 人类示例文件；
  - [x] `docker-compose.yaml` 路径统一；
  - [x] Dependabot 覆盖 GitHub Actions、npm/pnpm 和 Docker；
  - [x] `image-build` 已成功验证 Dockerfile；
  - [x] tag/手动镜像发布只使用 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`；
  - [x] 不 SSH、不远程部署、不自动创建 Release；
  - [ ] 修复当前 TypeScript/E2E 业务代码门禁；
  - [ ] `checks`、`image-build`、`e2e` 在同一最新 main 全部成功；
  - [ ] 本轮不创建 `v*` tag、不触发 Docker Hub 发布。
  _依赖：T34-F6。_

- [ ] **T34-F8 · C.1 总门禁与用户验收（由用户执行）**：
  - 实施者交付文档一致性、完整非 Docker 门禁、真实双 Bucket、长任务重启恢复和三视口证据；
  - 用户执行公开端、管理端视觉验收和新上下文独立 Review；
  - 实施者不得代签本项；
  - 用户确认后才勾选 T34-F8 与 GATE-C1；
  - 空环境 Compose、正式域名、TLS、升级/回滚/恢复和 Docker Hub 正式发布延期到部署阶段。
  _依赖：T34-F1–T34-F7。_

## D. P1 一期增强

- [ ] **T35 · 返图模型与可选授权记录**。_依赖：GATE-C1。_
- [ ] **T36 · 返图上传、轻量水印、管理与公开墙**。_依赖：T35。_
- [ ] **T37 · 展会掉落、当前展会与完整状态矩阵**。_依赖：GATE-C1。_
- [ ] **T38 · 受限站点文字内容扩展**：不建设万能 CMS。_依赖：GATE-C1。_
- [ ] **T39 · Slug 显式改址历史**。_依赖：GATE-C1。_
- [ ] **T40 · 30 天回收站**。_依赖：T36、T38。_
- [ ] **T41 · 手机轻量维护闭环**。_依赖：T36–T40。_
- [ ] **T42 · P1 全链路门禁**。_依赖：T41。_

## E. P2 独立后置

- [ ] **T43 · 邮件找回密码**。_依赖：GATE-C1。_
- [ ] **T44 · 安全 CSV 导出中心**。_依赖：GATE-C1。_
- [ ] **T45 · 永久原图档案 UI**。_依赖：GATE-C1。_
- [ ] **T46 · 最小化访问统计**。_依赖：GATE-C1。_
- [ ] **T47 · 高级媒体恢复与批量运维**。_依赖：T42。_
- [ ] **T48 · CDN 专项**。_依赖：T42。_
- [ ] **T49 · 上线前综合审查**。_依赖：T42；T43–T48 按实际范围。_
- [ ] **T50 · 全站最终 E2E 与浏览器视觉复核**。_依赖：T49。_

## F. 正式素材、正式环境与闭环

- [ ] **T51 · 正式素材衍生与二次视觉校准**：站点展示位继续无水印。_依赖：T42、EXT-01。_
- [ ] **T52 · 正式目标环境发布演练**：接入正式域名、证书、Bucket、备份、监控和发布回滚。_依赖：T50–T51。_
- [ ] **T53 · 景宸真实使用验收与文档闭环**。_依赖：T52。_

## 每项完成定义

每个任务至少留下：

- 变更范围与明确非目标；
- 迁移、兼容和回滚边界；
- 相关 lint/typecheck/build/unit/integration/E2E；
- UI/媒体任务的真实浏览器与三视口证据；
- 失败、冲突、重启恢复和隐私负路径；
- `implementation/notes/` 中的实施与 Review 记录；
- 当前活文档同步；
- 用户门禁任务的明确确认。
