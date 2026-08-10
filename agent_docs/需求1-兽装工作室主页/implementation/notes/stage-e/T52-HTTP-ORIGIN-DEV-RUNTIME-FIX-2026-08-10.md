# T52 HTTP origin 预检与本地 dev 运行时修复（2026-08-10）

## 基线与范围

- 实现基线：`03d9958`；
- 范围：修复宿主机 HTTP origin 检查器对停用 Certbot unit/历史
  Let’s Encrypt 文件的误判，并修复 Nuxt dev 产物错误解析
  `D:\scripts\esa-sdk.mjs`；
- 非目标：不启用 ECS/Nginx 443，不改变 ESA 边缘 HTTPS，不删除目标机任何
  unit、账户或证书文件，不连接或写入生产环境。

## 根因与契约

客户端 HTTPS 只在 ESA 边缘终止，ESA 到 ECS 固定使用 HTTP/80。宿主机真正
需要阻断的是 443 监听、Nginx 证书/ACME 配置、活动 ACME timer/service/process。
原检查器使用 `systemctl --all` 并全量扫描证书目录，把停用 unit 和未被 Nginx
引用的历史文件也判为 FAIL；这些静态残留不会改变当前运行拓扑。

本地 dev 的 `server/utils/public-media-cache.ts` 引用了仓库内
`scripts/esa-sdk.mjs`，但 Nitro 只内联了 `embedded-ffmpeg.mjs`。生成到
`.nuxt/dev/index.mjs` 后，ESA SDK 的外部相对引用越过仓库根目录，最终解析为
不存在的 `D:\scripts\esa-sdk.mjs`。

## 实现

- `deploy/host/verify-http-origin.sh` 继续检查 Nginx 80/443、证书配置、实际监听、
  loopback 3000、ready 和精确 Host；systemd 只查询活动 timer/service，仍以
  `pgrep` 阻断活动 ACME 进程；删除历史证书文件扫描与 `find` 依赖；
- 安全/可观测性策略和证据模板升为 schema 2，分别记录 Nginx 无证书配置、
  无活动 ACME 调度/进程，并明确允许不参与运行时的历史静态残留；
- `nuxt.config.ts` 使用绝对标准化路径把 `scripts/esa-sdk.mjs` 加入
  `nitro.externals.inline`，复用既有 SDK，不复制实现；
- 单测锁定活动状态查询、不扫描 `/etc/letsencrypt`，并锁定两个仓库内运行时
  模块都被 Nitro 内联。

## 本地验证

- targeted unit：2 个文件、11 项通过；
- full unit：31 个文件、168 项通过；
- `bash -n deploy/host/verify-http-origin.sh`：通过；
- `pnpm run verify:observability`：通过；
- 真实启动 `127.0.0.1:3000`：`GET /api/health` 返回 200；生成的
  `.nuxt/dev/index.mjs` 不再含越过仓库根目录的 ESA SDK 相对引用，SDK 内容已内联；
- `pnpm lint`、`APP_ENV=test pnpm typecheck`：通过；
- `APP_ENV=production pnpm build`（含 production content guard）：通过；
- `pnpm run verify:production`：通过；
- Secret scan：486 个 tracked 文件通过。

## 剩余门禁

本轮没有 SSH 到目标宿主机，也没有执行 live preflight、reload、文件删除或其他
云端写操作。新提交/镜像部署后仍需在目标机重新运行 HTTP origin 检查器；该次
工程自测不代签独立 Review、GATE-E 或用户验收。
