# T34 P0 全链与可部署门禁

## 启动边界

- 启动基线：`23b8004`，`main` 与 `origin/main` 一致，工作树干净。
- 范围：完整静态/单元/集成/E2E/build/production verify、公开与管理真实浏览器全链、SQLite 备份恢复、真实双 Bucket、部署镜像、secret scan 和独立 Review。
- 复用：现有 Playwright 临时空库/管理员/假媒体全链、T31 备份恢复命令、`preflight:oss`、`preflight:watermark` 和 production 守卫；不另建第二套测试框架。
- 用户门禁：本记录可以关闭工程 finding，但 T34 在用户最终验收前保持未勾选。

## 修复前初始 finding

基线结论：`NOT PASS`。

1. **MUST-FIX · 缺少可部署镜像定义**：PLAN 明确一期为单 Docker 镜像，TASKS T34 要求形成首个可部署镜像，但仓库没有 `Dockerfile` 或 `.dockerignore`，无法构建、验证非 root 运行、持久数据库挂载、重启保持或镜像 secret 边界。应只增加最小多阶段镜像和精确 context 排除，不提前实现 T52 的目标环境编排、TLS、域名或数据库迁移自动化。

## 执行记录

### 可部署镜像修复与验证

- 新增最小多阶段 `Dockerfile` 与 `.dockerignore`：Node 24、pnpm 11.18 frozen install、Nuxt production build、非 root `node`、`/app/data/studio.db`、单进程；排除 `.env*`、本地配置、数据库、缓存、测试和证据目录。
- `docker build --progress plain -t project-fur-forge:t34 .` 首次成功，113.5 秒；context 2.49 MB，镜像 120,932,780 bytes。容器配置为 `USER=node`、`/app/data` volume。
- 首次容器启动按预期被运行配置校验拒绝：本地 `.env` 的 `SESSION_SECRET` 为空。没有改写 `.env`；改为进程内生成 48-byte 临时随机 secret，并以部署参数注入。
- 第二次启动通过：容器内 `uid=1000(node)`；health、公开首页、`/works/doggy`、管理登录均 200，错误 Host 421。精确重启后 health 与详情仍 200，挂载数据库保持可写。
- 活跃 SQLite 的直接 `Get-FileHash` 因文件锁失败，两个空值不能作为“hash 稳定”证据；停止容器后按现有数据库方法验证 `integrity_check=ok`、0 个外键错误、3 件作品、2 项 Hero。
- 根文件系统清单无 `.env`、`runtime.local.json`、`studio.db`、`agent_docs` 或 `tests`；image history 无敏感赋值。逐值扫描脚本首次误用 `process.argv[1]` 而读取 `-` 失败，改为实际参数后扫描 334,384,128-byte rootfs tar，3 个本地敏感值 0 命中。
- 两个精确容器和隔离临时目录已删除；镜像 `project-fur-forge:t34` 保留用于独立 Review。T52 仍负责目标环境编排、TLS、正式域名与迁移演练。

初始 Docker MUST-FIX 已由真实 build/start/restart/secret 验证关闭。T34 仍等待完整门禁与独立 Review，不勾选。

### 完整自动化首轮

- `pnpm lint`：PASS，10.4 秒。
- `pnpm typecheck`：PASS，11.6 秒。
- `pnpm test`：18 文件、104 项全部通过，18.1 秒。
- `pnpm test:integration`：12 文件、102 项全部通过，66.2 秒。
- `pnpm test:e2e`：首轮 `NOT PASS`，206 项中 18 项失败，463.5 秒；失败目录与 trace 保留在本轮临时 `test-results`，修复后不把首次结果改写为通过。

首轮 E2E findings：

1. **MUST-FIX · 全量 E2E 未隔离生产限流状态**：认证负路径和后续管理写入共用同一进程全局 30/60 次窗口；先运行的认证用例耗尽登录窗口，品牌/大图测试收到 429，累计管理写入又使创建作品收到 429，形成 18 项连带失败。产品限流契约正确，测试需通过只在 `APP_ENV=test` 注册的精确 reset handler 在测试边界清理状态，不得放宽生产限额或增加生产 bypass。
2. **SHOULD-FIX · 累积夹具与分页断言未隔离**：全量串行运行后作品数达到 33，少数管理列表用例直接在当前页按文字找新建行；新行不保证位于第一页，导致找不到元素。应复用页面现有“查找作品”输入定位自己的唯一夹具，不移除分页或扩大默认页数。
3. **SHOULD-FIX · 公开预览测试依赖已移除说明文案**：管理预览已用“角色主人：不公开”表达安全公开值，旧 E2E 仍要求额外出现“不含联系人”。隐私边界应断言联系人值、Object Key 和签名参数缺失，并核对当前安全公开值，不为测试恢复冗余文案。

测试生成的 26 张已跟踪历史截图由本轮精确识别，待诊断完成后统一恢复，不作为产品改动提交。

修复与复测：

- 复用只在 test build 注册的 `/api/e2e-fake-media-control`，增加 `resetRateLimits` 动作；每个 `loginAsAdmin` 边界重建服务端 30/60 次窗口。生产 middleware、限额和路由均未增加 bypass。
- 列表断言使用既有“查找作品”输入定位“雪团”“列表领养”“列表媒体验证”唯一夹具；公开预览断言当前安全公开值“不公开”，并继续逐值拒绝联系人、私有 Key 与签名参数。
- 首次六套管理定向复测把失败从 18 项降至 2 项，暴露“雪团”分页定位和旧“不含联系人”文案；修正后 `admin-works.spec.ts` 26/26 通过，101.4 秒。
- 第二次完整 `pnpm test:e2e` 从新临时空库/新服务进程启动，206/206 通过，432.3 秒。首轮 1 个 MUST-FIX 与 2 个 SHOULD-FIX 全部关闭。
- 最终完整 E2E 生成的 32 张已跟踪历史截图已精确恢复；截图不作为本次变更提交。

### 最终自动化

- `pnpm lint`：PASS，10.4 秒。
- `pnpm typecheck`：PASS，12.7 秒。
- `pnpm test`：18 文件、104/104 通过，17.9 秒。
- `pnpm test:integration`：12 文件、102/102 通过，65.1 秒。
- `pnpm test:e2e`：206/206 通过，432.3 秒。
- `pnpm build`：PASS，53.9 秒；仅有已知的 Nuxt 插件计时提示。
- `pnpm verify:production`：PASS，3.0 秒。

### 真实双 Bucket

- 一次误把 `node scripts/oss-watermark-centered-v2.mjs --help` 当作帮助命令；脚本没有帮助分支，外层 12.5 秒超时但实际安全完成 `gate07-20260804T224247Z-a3b22043`，并精确清理 10 个测试对象。该命令状态不计作正式 PASS。
- 正式 `pnpm preflight:watermark`：PASS，11.4 秒，run ID `gate07-20260804T224345Z-e58071e8`；12 项检查全部通过，5 个私有源/Logo 匿名 403，5 类公开水印预览通过并精确清理。
- 正式 `pnpm preflight:oss`：PASS，19.5 秒，run ID `t10-20260804T224422Z-dd77d872`；27 项检查全部通过，覆盖双 Bucket、CORS/OPTIONS、FFmpeg 大图、V4 条件写入、覆盖拒绝、私有 403、公开水印差异、源文件不变与精确清理。`consoleActions=[]`，`secretsRecorded=false`。

### 备份恢复、发布链与真实浏览器

- 在系统临时目录执行现有 `pnpm db:backup` 与 `pnpm db:restore`：均 PASS，总计 3.3 秒。
- 恢复库发布链脚本首次读取历史字段 `logo_asset_id`，因当前 schema 使用 `source_asset_id` 而在任何写入前失败；改用当前字段后，复用现有 service 和假媒体存储创建隔离作品，`canPublish=true`、缺少 12 个公开变体，发布 operation `DONE`、状态 `published`，随后下架 operation `DONE`、最终 `unpublished`，假公开对象余量 0。
- 恢复库最终 `integrity_check=ok`、外键违规 0、4 件作品；隔离作品保持 `unpublished`。
- `.output` 恢复库浏览器验收使用 `APP_ENV=test`，因为运行时按设计只允许 production 数据库位于 `/app/data/studio.db`、development 数据库位于 `.data/dev.db`；production 路径已由前述 Docker 容器独立覆盖。
- Chrome 在 `390×844`、`768×1024`、`1440×900` 逐一访问公开首页、作品列表、`/works/doggy` 与管理登录页：全部 200，无横向溢出、无坏图、无页面异常或请求失败；未知公开路由返回 404“页面未找到”。管理登录页唯一 console 401 来自未登录时预期的 `/api/auth/session`。
- 终止工具只结束外层 shell，留下监听 3300 的精确 Node 子进程；核对 PID、进程名与可执行文件后停止该进程。恢复库临时目录经绝对路径和系统临时根校验后删除，不保留用户数据或测试产物。

## 当前结论

实现方结论：`PASS，等待独立 Review`。初始 Docker MUST-FIX、全量 E2E MUST-FIX 与两个 SHOULD-FIX 均已保留并关闭；T34 在独立 Review 和用户最终验收前继续保持未勾选。
