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
