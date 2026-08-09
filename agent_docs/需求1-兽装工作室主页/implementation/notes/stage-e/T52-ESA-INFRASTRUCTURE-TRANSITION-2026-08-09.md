# T52 ESA 基础设施切换记录（2026-08-09）

> 用户授权的远程基础设施变更记录；不代表 T52 工程、独立 Review 或正式上线完成。

## 已执行

- 目标机：`120.26.51.205`。
- `/etc/nginx/conf.d/ditedog.conf` 改为 HTTP/80 origin，代理 `127.0.0.1:3000`；未知 Host 与媒体 Host 返回 `421`。
- 删除 443/TLS server 和 HTTP→HTTPS 跳转；`nginx -t` 通过后 reload。
- 运行 acme.sh uninstall，移除 root 每 6 小时续期 cron、shell alias、`/root/.acme.sh` 与 `/etc/nginx/ssl`。

删除的本地证书、私钥、ACME 账户/config-home 和 DNS API 配置不能从服务器原路径恢复；如未来需要，只能重新签发和配置。

## 验证

- Nginx systemd 服务为 `active`，配置测试通过；
- 仅监听 80，443 不监听；
- app 未运行时返回受控 503，媒体/未知 Host 返回 421；
- root crontab 无 acme.sh，ACME 与证书目录不存在。

## ESA 当前状态

- NS 模式和边缘证书已配置；
- ECS origin 已限制为 HTTP/80；
- `public-media.ditedog.com` 已配置为网页衍生 Bucket 的同账号私有访问；阿里云自动使用 STS 完成回源鉴权，业务应用不实现 STS；
- 首版不做自定义边缘 URL 鉴权；
- wildcard 路由仍是预部署状态，正式上线前收敛为公开/管理精确 Host。

服务器 HTTP-only origin 基线已生效。剩余工作仍以 T52-E1～E6、T49、T50、GATE-E 和 T53 为准。
