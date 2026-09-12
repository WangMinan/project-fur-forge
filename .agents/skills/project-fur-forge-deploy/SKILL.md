---
name: project-fur-forge-deploy
description: Safely deploy project-fur-forge production images from GitHub Actions with an immutable digest, including main fast-forward, secret-safe environment checks, SQLite backup and migration, app-only recreation, verification, rollback decisions, and explicitly authorized scoped cleanup. Use for later production image updates; route first deployments and destructive media retirement to their dedicated runbooks.
---

# 有点小狗生产部署

用于 `/root/project-fur-forge` 的后续生产镜像更新。目标是让 Git commit、冻结镜像、数据库状态和运行服务保持同一版本，并留下可验证的回滚资产。

## 授权边界

- 部署授权包含：获取目标 `main`、核验 Actions 发布证据、仅更新 `.env` 的 `APP_IMAGE_REF`、按目标版本文档备份/迁移、仅重建 `app` 及只读验收。
- 部署授权不包含：删除数据库/备份/媒体、恢复覆盖、云侧配置修改、修代码、重新发布镜像或全局 Docker 清理。它们需要各自明确授权。
- “清理旧镜像和数据库备份”不授权删除 OSS/ESA 上的公开媒体。
- 现场证据优先于历史记录。不要把旧 run、digest、备份路径、迁移数量或主机快照当作当前事实。

## 先读并分类

1. 读取仓库根目录 `CLAUDE.md` 第 4 节、[`docs/DEPLOYMENT.md`](../../../docs/DEPLOYMENT.md) 和[生产发布手册](../../../agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。
2. 从 `agent_docs/README.md` 找到目标版本需求，读取 `STATE.md`、`requirements/SPEC.md`、`implementation/TASKS.md`，以及命中的生产迁移/发布交接。
3. 比较当前 `HEAD..origin/main`。重点检查 migration、journal、schema、`docker-compose.yaml`、`.env.compose.example`、Dockerfile、Nginx/ESA 配置和运维脚本。
4. 无数据库/部署契约变化时走普通更新；存在 migration、停写、恢复或删除时，必须先读[迁移与恢复](references/migrations-and-recovery.md)。每次部署都读[验收与清理](references/acceptance-and-cleanup.md)。

## 固定摘要部署

### 1. 建立发布身份

- 先确认工作树、分支、当前运行镜像与回滚资产；保护已有用户修改。
- 对用户给出的 Actions run 使用认证 `gh run view`，确认 `release-image`、`main`、成功结论和 `headSha`。
- 列出并下载精确的 `image-release-evidence-<full-sha>` artifact；以其中的 `commit`、`imageRef` 和 `digest` 为唯一部署身份。artifact 名不确定时先用 GitHub API 列表，不猜名字。
- 禁止使用 `latest`、tag、短 SHA 或服务器现场 build。

### 2. 同步冻结代码

```bash
git fetch origin main
test "$(git branch --show-current)" = main
git merge --ff-only origin/main
test "$(git rev-parse HEAD)" = "$TARGET_SHA"
test -z "$(git status --porcelain)"
```

目标 run 的 commit 不是最新 `origin/main` 时停止：不能用更新的工作树部署较旧镜像，也不能把不匹配的镜像接到新 migration。

### 3. 校验 `.env`

- 不执行 `source .env`，不整文件打印、截图或复制 Secret。
- 校验文件被 Git 忽略、权限 `600`、无重复键，且 `.env.compose.example` 的键没有缺失；Secret 只报告非空布尔值。
- 校验公开/管理 URL、数据库绝对路径、OSS 内外网 endpoint、Bucket、ESA、可信代理和 SMTP 字段之间的关系。
- 只修改 `APP_IMAGE_REF`；配置契约确有变化时才修改其他值，并单独说明依据。修改后恢复 `chmod 600 .env`。
- `docker-compose.yaml` 才是生产 Compose；唯一常驻服务必须是 `app`。

### 4. 拉取并验明镜像

在停止服务前完成：

```bash
docker compose config --quiet
test "$(docker compose config --services)" = app
docker pull "$TARGET_IMAGE_REF"
docker image inspect "$TARGET_IMAGE_REF"
```

同时断言：Compose 解析出的镜像等于 artifact `imageRef`，镜像的 `RepoDigests` 包含该完整引用，OCI `org.opencontainers.image.revision` 等于目标 commit。记录本地 image ID；只有 artifact 另行提供 config digest 时才比较二者，不能把 registry manifest digest 普遍当作 image ID。任一身份不匹配都停止，不重建容器。

### 5. 备份、迁移和重建

- 无 migration 时仍按 `docs/DEPLOYMENT.md` 创建带 UTC 时间戳的显式升级前备份并运行幂等 migrate。
- 有 migration 时严格使用目标需求的生产迁移说明；是否停写、预期 `applied` 数和是否复跑由该说明决定，不能套用旧版本结论。
- 所有一次性命令使用同一个目标冻结镜像：`docker compose run --rm --no-deps app node ops/ops.mjs ...`。
- 只重建应用：

```bash
docker compose up --detach --no-build --no-deps --force-recreate app
```

不要启动第二个常驻服务，不改变卷、端口、Nginx 或 TLS 拓扑。

### 6. 验收与交接

- 轮询内部 `127.0.0.1:3000/api/health/ready`，请求头使用生产公开 Host；启动初期的 reset/empty reply 可短暂重试。
- 按[验收与清理](references/acceptance-and-cleanup.md)核验容器、数据库、Nginx、公开/管理路由、媒体及本次变更。
- 最终报告 commit、完整 digest、备份路径、迁移首跑/复跑结果、数据库完整性、容器健康和所有未通过/未执行项。
- 验收前保留旧镜像、活动数据库、显式备份和 migration 自动备份。不要顺手清理。

## 停止条件

- Actions 证据、commit、digest 或 OCI revision 不一致。
- 工作树存在无法绕开的用户改动，或目标 commit 不是可安全快进的 `origin/main`。
- `.env`/Compose 解析失败、Secret 缺失或端点关系不成立。
- migration 历史不匹配、目标 runbook 缺失、预期数据前置条件不成立，或发现删除/媒体退役却没有单独授权。
- 备份失败、迁移结果异常、FK/integrity 失败或数据守恒检查失败。

发生以上情况时保留现场和输出；不要删除 journal、重写 migration hash、切换 tag、直接连旧镜像或用恢复掩盖新写入。
