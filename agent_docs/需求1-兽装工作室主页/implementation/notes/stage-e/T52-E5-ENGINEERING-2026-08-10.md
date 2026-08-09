# T52-E5 工程记录（2026-08-10）

## 结论

T52-E5 已完成工程实现和本地定向门禁，可以继续 T52-E6。该结论不代表真实 ESA WAF、速率规则、源站保护、套餐/配额或告警已经在控制台配置，也不代表生产阈值已经校准；这些仍属于 T53。T49 新上下文独立 Review 保持开放。

用户确认的英文品牌继续保持完整 `DITE DOG FURSUIT`；本任务没有改名或缩写品牌。

## 实现

- `deploy/esa/security-observability-policy.json` 固化 Free 仅限开发/验证、正式套餐待 T53 当日确认、ESA 托管边缘证书/强制 HTTPS、ECS HTTP/80、源站保护、WAF observe-first 与三类速率规则；生产套餐、QPS、预算、用量封顶、告警和测量数值全部保持 `null`。
- `verify:observability` 对上述边界做机器校验，显式拒绝提前写入的生产套餐、费用、限流、用量封顶、告警或测量数字，也拒绝源站 TLS、公开 3000 和宿主机证书漂移。
- `measure:production` 只接受无凭据、无 query/fragment、标准 443 的精确 HTTPS 目标；记录响应字节、首次/重复时延、cache evidence headers、HTTP→HTTPS 和 ESA 边缘证书，不保存响应正文、Cookie 或 Secret。首次结果只叫 `first-observed`，除非 T53 另有 purge/新对象/cache miss 证据，否则不能称为 cold。
- 受控请求量/峰值探测默认关闭，必须显式 `--allow-load-probe`，并限制在最多 100 请求、并发最多 10；工具只输出观测值，不计算或写入生产阈值。
- `deploy/host/verify-http-origin.sh` 默认只读检查 Nginx config、HTTP/80、无 443、app loopback 3000、ready、公开/管理精确 Host、无 ACME/Certbot/证书残留；只有显式 `--reload` 且此前检查通过才安全 reload，并在 reload 后重做 config test。
- `deploy/esa/observability-evidence.example.json` 覆盖 ESA 套餐/流量/源站 5xx/边缘 4xx/5xx/缓存命中/purge/托管证书，以及 ECS/磁盘/Nginx/容器/ready；所有真实值和证据引用留给 T53 填写。
- Handbook 补充目标环境命令、解释边界、停止条件和脱敏要求。预算只通知；套餐配额、用量封顶和计量都可能有统计延迟，不声称自动强制停费。

## 验证

| 命令/检查 | 结果 |
| --- | --- |
| `bash -n deploy/host/verify-http-origin.sh` | PASS |
| `pnpm run verify:observability` | PASS |
| E5 定向 unit | PASS，2 files / 8 tests |
| `APP_ENV=test pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `APP_ENV=test pnpm test` | 首次既有 E2 dry-run CLI 用例超过 5 秒，不计通过；单独重放 7/7 PASS，随后完整重跑 PASS，28 files / 155 tests |

真实域名测量、主机 live/reload 与 ESA 控制台告警不在 E5 冒充执行。

官方依据：

- [ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)
- [ESA 安全规则](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/security-rules)
- [ESA 频率控制](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/frequency-control-rules)
- [ESA 缓存命中率优化](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/improve-cache-hit-ratio-on-esa)
