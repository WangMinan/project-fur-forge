# 阶段 E 宿主机 Nginx 与 ACME 决策（2026-08-09）

> **性质**：用户确认的生产部署与 TLS 决策。活契约仍以 SPEC、PLAN、TASKS、STATE 和上线 Handbook 为准。
> **覆盖关系**：覆盖聊天中曾考虑的原生 `nginx-module-acme` 方案，以及同日一度提出的“重装 acme.sh + 自建 systemd timer”复杂方案。

## 1. 最终决定

- 复用用户已经在 `120.26.51.205` 配好的宿主机 Nginx、acme.sh、证书路径和 cron，不重装、不重签、不迁移到 systemd timer；
- Nginx 继续由宿主机 systemd 管理，不运行 Nginx 容器；
- Compose 的唯一常驻服务是 Nuxt/Nitro `app`；migrate、preflight、backup、restore 和 recover 使用同一冻结镜像的一次性容器；
- app 只绑定 `127.0.0.1:3000`，由宿主机 Nginx 反向代理；安全组不开放 3000；
- 证书继续由 `acme.sh + dns_ali` 自动续期，不使用 Certbot 或 `nginx-module-acme`；
- 媒体域名在阿里云 CDN 终止 TLS，不由宿主机 Nginx 证书服务。

## 2. 2026-08-09 只读 SSH 盘点

目标机：Ubuntu 24.04.4 LTS。

### Nginx

- nginx.org stable `1.30.4`，systemd `enabled + active`；
- `/etc/nginx/conf.d/ditedog.conf` 配置测试通过；
- 80/443 对外监听，默认 server 对不匹配的 HTTP/HTTPS Host 返回 `421`；
- 当前业务 server 接受 `ditedog.com` / `*.ditedog.com`，HTTP 请求 `308` 跳转 HTTPS；正式上线前仍应收敛为公开/管理精确 Host，wildcard 只保留在证书 SAN；
- HTTPS upstream 为 `127.0.0.1:3000`；app 未启动时返回受控 `503`；
- 公网 80/443 可达，3000 不可达；
- 公共 DNS 的 `ditedog.com A` 已指向 `120.26.51.205`，因此 app 未部署前公网访问会得到 `503`；这是已存在的预上线状态，不代表正式切换完成；
- 私钥 `/etc/nginx/ssl/ditedog.com/privkey.pem` 为 root `0600`。

### acme.sh 与证书

- acme.sh `3.1.5`，root home `/root/.acme.sh` 为 `0700`；
- `account.conf` 和域名配置为 root `0600`，保存的 Aliyun DNS Key 未读取或回显；
- `dns_ali` + Let's Encrypt production，ECDSA P-256；
- 证书 SAN 为 `ditedog.com`、`*.ditedog.com`，证书与私钥匹配；
- 有效期：`2026-08-09` 至 `2026-11-07`，acme.sh 计划下次续期时间为 `2026-10-09`；
- root cron 每 6 小时运行一次 `acme.sh --cron`；没有 acme.sh systemd timer；
- `--install-cert` 已写入 Nginx 稳定 key/fullchain 路径；reload command 当前是 `systemctl reload nginx`；
- 公共 DNS 没有活动 `_acme-challenge` TXT 答案。

### Certbot 残留

- `/usr/local/bin/certbot` 仍指向 `/opt/certbot/bin/certbot`；
- 没有 `certbot.timer`，也没有活动的 Certbot 续期任务；
- 它不参与当前证书链。后续可清理，但不阻断部署，也不在未确认时直接删除。

## 3. 只保留三个最小缺口

1. **仓库部署契约**：T52-E6 把 Compose 收敛为唯一常驻 app，并让端口只绑定 `127.0.0.1:3000`；把当前宿主机 Nginx 配置整理为版本控制内模板，正式 `server_name` 只列公开/管理精确 Host。
2. **reload 安全**：通过 `--install-cert --ecc` 把 acme.sh 的 reload command 收敛为 `/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx`，避免无效配置被静默 reload；不改变现有 cron。
3. **最小监控**：检查 cron 仍存在、最近续期结果可读、证书剩余天数可告警；不建设第二套调度器。

此外，T53-F2 仍要在阿里云控制台核对 ACME RAM Key 只具有承载该域名的 DNS zone 所需权限。当前 `dns_ali` 使用 `DescribeDomainRecords`、`AddDomainRecord`、`DeleteDomainRecord`；阿里云可按 domain 资源授权，但不能进一步限制为只操作 TXT，因此专用 Key、最小 zone、文件权限和 DNS 审计仍然必要。

## 4. 阶段归属

### 阶段 E

- 不重做已完成的宿主机安装或证书签发；
- T52-E6 只交付 app-only Compose、与现状一致的 Nginx 模板、reload 安全入口和最小检查命令；
- T49/T50 在受控环境检查 loopback、proxy headers、未知 Host、503 恢复和 Secret 不进入容器；
- GATE-E 冻结应用镜像和仓库部署模板，不冻结或复制远程 ACME Secret。

### 阶段 F

- 把本次 SSH 结果视为 GATE-E 前的预检证据，不提前勾选 F2/F3/F4；
- 部署冻结 app 后复核 Nginx→Nuxt、正式公开/管理 Host、证书、cron、reload 和外部 3000 拒绝；
- 不要求重新安装 Nginx/acme.sh、重新签发当前有效证书或切换调度器；
- 只有配置实际失效或证书临近到期时才按现有 acme.sh 入口重签/恢复。
