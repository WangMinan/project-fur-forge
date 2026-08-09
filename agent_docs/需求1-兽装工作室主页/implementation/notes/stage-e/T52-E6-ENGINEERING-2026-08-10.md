# T52-E6 工程记录（2026-08-10）

## 当前结论

T52-E6 的应用、Compose、宿主机 Nginx 模板、运维入口、Handbook 和 CI 受控演练已完成本地实现。本记录提交时，目标机只完成只读核对，GitHub Actions 的镜像/Compose/Nginx 受控演练尚未取得结果；因此 `TASKS.md` 的 E6 勾选保持开放，不能把本地门禁写成远端全绿，也不进入 T49。

用户确认的英文品牌保持完整 `DITE DOG FURSUIT`；实现常量和完整名称断言没有改动。

## 目标机只读核对

2026-08-10 通过 `ssh -o BatchMode=yes root@120.26.51.205` 只读检查，未 pull、未读取或创建 `.env`、未修改 Nginx、Docker、网络、安全组、仓库或云资源：

- Ubuntu 24.04.4 LTS（Noble），Linux 6.8.0-124-generic，amd64；
- 官方 nginx.org Noble 包 `nginx 1.30.4-1~noble`，systemd enabled + active；
- `/etc/nginx/nginx.conf` 已包含 `/etc/nginx/conf.d/*.conf`，实际站点文件为 `ditedog.conf` 和 `00-connection-map.conf`；
- Nginx 仅监听 IPv4/IPv6 80，未监听 443；应用 3000 未监听；
- Docker Engine 29.6.2、Compose v5.3.1，服务 enabled + active；
- 仓库为 `/root/project-fur-forge`，当时是干净的 `main@19d0b3c8`；没有 `.env`、业务容器、业务卷或自定义网络；
- 根盘 40 GiB，可用约 29 GiB；UFW inactive，源站 80 的生产限制仍必须由阿里云安全组/ESA 源站保护留证；
- 既有 `mihomo` 监听不属于本应用，本任务不修改。

此前未提交的泛化 Nginx 包管理、配置管理和远程 release wrapper 已删除，没有进入本次差异。Handbook 改用符合该机器现状的原生 `git`、`docker compose`、`nginx`、`systemctl`、`install` 和精确文件备份命令。

## 实现

- `docker-compose.yaml` 只保留唯一常驻 `app`，镜像必须是不可变 `repository@sha256:digest`；端口只发布到 `127.0.0.1:3000`，保留非 root、只读根文件系统、持久 data/backups 卷、健康检查、单实例和固定 `172.30.250.0/24` bridge。
- migrate、init-admin、preflight、backup、restore-verify、restore 和 recover 全部复用同一镜像的 `docker compose run --rm --no-deps app`；operation recover 补齐返图 publication runner 注册。
- production runtime 强校验固定 Compose gateway `172.30.250.1/32` 与至少一个 ESA 代理 CIDR；模板中的 `replace-me` 故意非法，真实列表未填写时 fail closed。
- Nginx 模板对应目标机 `/etc/nginx/conf.d/ditedog.conf` 和 `00-connection-map.conf`：upstream 固定 `127.0.0.1:3000`，只监听 80，公开/管理精确 Host，媒体/未知 Host 421，向应用冻结 `X-Forwarded-Proto=https` 和 `X-Forwarded-Port=443`，不含 443、证书、ACME 或跳转。
- `release-image` 改为唯一手动入口：只允许从 `main` 选择与输入相同的 40 位 GATE-E SHA，要求显式确认，不发布 `latest`，输出镜像 digest 证据；阶段 E 没有触发发布或创建 `v*` tag。
- quality 的镜像任务构建生产镜像，演练空卷迁移、初始化、dry preflight、loopback ready、备份/restore-verify/recover、重启、恢复到新数据库路径、切回原路径、两个不同镜像 ID 之间的受控回滚，以及 Nginx 1.30.4 config test/reload、Host、scheme、Session 与 CSRF。
- Handbook 按目标机实际路径记录首次部署、精确 Nginx 文件备份/恢复、空卷、镜像摘要、停止条件、数据库新路径恢复和首次部署没有旧生产镜像这一事实，不用通用安装脚本覆盖宿主机。

## 本地验证

| 命令/检查 | 结果 |
| --- | --- |
| 目标机 SSH 只读核对 | PASS；结果如上，无远程写入 |
| `git diff --check` | PASS |
| 三份 YAML 解析 | PASS |
| E6/runtime/preflight/address 定向 unit | PASS，4 files / 39 tests |
| `APP_ENV=test pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `APP_ENV=test pnpm test` | PASS，29 files / 161 tests |
| 定向 integration | PASS，4 files / 38 tests |
| `pnpm ops:build` | PASS，recover 入口已进入 bundle |
| `APP_ENV=production pnpm build` | PASS |
| `pnpm verify:production` | PASS |
| `pnpm verify:esa-cache` | PASS |
| `pnpm verify:observability` | PASS |

本机没有 Docker CLI，因此不能把 quality 中的容器演练冒充本地执行。提交后必须等待 Actions 的 `image-build` 实际结果，再决定 E6 是否可勾选。

## 首次 Actions 结果与修复

首次实现提交 `332744ab` 的 Actions run `31325728593` 为 `failure`，保留该 NOT PASS：

- `checks` 在 integration 失败，39/168 失败；CI 没有本地 `.env`，四个测试 origin 为空，严格 runtime Schema 正确拒绝。修复为只在 integration step 显式注入四个互异的 `.invalid` 测试 origin；同组环境本地完整重放为 20 files / 168 tests PASS。
- `image-build` 已成功构建生产镜像、空卷 migrate 和 init-admin，随后 dry preflight 正确拒绝 `example.test` 占位 origin。修复为在受控 Compose/Nginx 演练中使用明确非生产的 `.invalid` Host 和不含 placeholder 标记的合成凭据；没有放宽 preflight 的生产占位拒绝规则。
- 因 `checks` 失败，首次 `e2e` 被跳过；不能计为通过。修复提交后必须重新取得 `checks`、`image-build`、`e2e` 同一 SHA 结果。

第二次提交 `47211e95` 的 Actions run `31326347449` 越过 image build、空卷 migrate、init-admin 和 dry preflight，但 app health 失败。原因是应用严格 Host 隔离，而容器 healthcheck 和宿主机 ready 命令直接请求 `127.0.0.1`，没有携带公开 Host；这在本地 production verify 中被与 base URL 相同的 loopback Host 遮住。修复为 healthcheck 使用 Node `http.get` 显式发送 `PUBLIC_BASE_URL` 的 Host，CI、目标机检查器和 Handbook 的 loopback ready 请求也显式携带公开 Host；没有放宽应用 Host 白名单。

修复后用迁移完成的临时数据库启动现有 production output：携带 `Host: public.test.invalid` 的 loopback ready 返回 200，同一路径使用 `Host: 127.0.0.1:3000` 返回 421，证明 health 修复保留了 Host 隔离。

第三次提交 `9353864a` 的 Actions run `31326725491` 中 `checks` 成功，image-build 也越过初始 health、备份、restore-verify、recover 和重启，但恢复到 `/app/data/ci-restored.db` 后应用退出。冻结代码仍把 production 数据库硬编码为 `/app/data/studio.db`，与 SPEC/TASKS/PLAN 已锁定的“恢复到新路径再切换”冲突。修复为只允许 `/app/data` 直属、规范化后的 `.db` 文件：保留 volume/path traversal 边界，同时允许经过 restore 校验的新数据库文件启动。
