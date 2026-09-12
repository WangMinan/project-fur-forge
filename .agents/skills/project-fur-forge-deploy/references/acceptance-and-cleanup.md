# 部署验收与清理

每次生产部署都读取验收部分；只有用户明确要求清理时才读取并执行清理部分。

## 固定运行验收

1. `docker compose ps` 只有一个常驻 `app`；容器为 `healthy`，镜像和 OCI revision 等于目标证据，端口只绑定 `127.0.0.1:3000`。
2. 内部 readiness 使用 `Host: ditedog.com`；公网 `/api/health/ready` 故意返回 404，不能用它判断服务失败。
3. 活动 SQLite 必须 migration current、`integrity_check=ok`、FK=0。显式备份用匹配其 migration 集的冻结镜像验证。
4. 运行：

```bash
bash deploy/host/verify-http-origin.sh \
  --public-host ditedog.com --admin-host admin.ditedog.com
```

5. 核验 HTTP→HTTPS 301、公开和管理入口 HTTP/2 200、`/admin/login` 可达、匿名管理 API 401、媒体/未知 origin Host 421、抽样公开媒体为 200 图片。
6. 匿名 `/admin` 当前是 200 的客户端认证壳，不再要求旧的 302；应确认没有 dashboard 标记或数据泄漏。
7. 公开 HTML/API 不得出现私有 OSS 域名、私有 Object Key、Secret、PII；公开 API 继续绕过共享缓存。

## 版本特定验收

- 从目标 SPEC、migration 说明和实际 diff 提取最小的可观察断言，不复用上一版本的 DOM、计数或字段假设。
- migration 验证守恒、seed、重入和回滚兼容性；媒体变更验证 READY 投影、公开 URL 与可解码字节。
- SMTP 相关版本可用 Nodemailer `transport.verify()` 验证 TLS/auth，但不得发送测试邮件。
- OSS 相关版本从数据库选择一个 READY 公开变体，经服务端内网 endpoint 只读获取；不要输出对象 Key、凭据或签名 URL。
- 不为验收擅自修改正式文案、营业状态、X 地址或其他生产数据。确需写入/恢复的验收必须在用户授权范围内，记录精确前值并以 CAS/守卫恢复。

## 构建期与运行期配置

Compose 注入的 `APP_ENV=production` 只证明运行容器环境正确。若改动在 `nuxt.config.ts` 构建时读取 `process.env`，必须同时检查 Dockerfile 的 build stage 和公网最终行为；运行时 `.env` 无法修复已经编译进镜像的值。

例如 Cookie 的 `Secure`、SSR 语言或生产内容 guard 应从 HTTPS 响应验证。发现非数据破坏性的发布缺陷时，明确报告影响，保留新旧回滚资产；不要为了低风险前端问题擅自恢复已经前向迁移的数据库，修复通常需要新 commit 和新冻结镜像。

## 日志与最终状态

- 检查新容器启动后的 fatal、uncaught、migration/database 错误；预期的匿名 401、隐藏 readiness 404 不算故障。
- 最终状态必须同时满足：仓库目标 SHA、`.env` 目标 digest、运行容器 digest/revision、数据库 migration 集一致。
- 明确列出未执行的认证后台写入、真实手机或云控制台验收，不代签。

## 仅在明确授权后清理

先盘点，再逐项删除：

- 列出项目镜像的 RepoDigest/image ID、运行/停止容器引用和目标/回滚关系。
- 列出两个应用备份位置中的 `.db`、`-wal`、`-shm`，确认活动数据库路径；用匹配版本镜像验证计划保留的备份。
- 至少保留当前镜像、一个已验证的回滚镜像、当前升级前备份和任何专属灾难恢复备份；迁移/媒体退役 runbook 的保留要求优先。
- 把准备删除的完整 digest/image ID 和备份/边车绝对路径解析成精确清单。用户当前请求明确授权了对应类别、且上述保留规则能得出唯一安全集合时可以执行；保留选择、目标归属或引用状态有歧义时，先把清单交给用户确认。
- 只删除已证明无引用的精确项目镜像和已授权的精确备份/边车文件。禁止 `docker image prune`、`docker system prune`、模糊 glob 或递归删除。
- 删除后重新盘点，并复验容器健康、内部 readiness 和公网入口。

本地 Docker/数据库备份清理授权永远不扩展到 OSS 对象、ESA 缓存、生产媒体或数据卷。
