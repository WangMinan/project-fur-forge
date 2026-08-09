# 有点小狗 · 上线手册

> 当前不能上线：T52-E1～E6、T49、T50 和 GATE-E 尚未完成。本手册只保留目标环境真正要执行的内容。

## 1. 已知生产参数

| 项目 | 当前值 |
| --- | --- |
| ESA Site | `ditedog.com`，Site ID `171890925863148` |
| 权威 NS | `nasser.ns.atrustdns.com`、`hindu-kush.ns.atrustdns.com` |
| ECS origin | `120.26.51.205:80`，HTTP |
| app upstream | `127.0.0.1:3000` |
| 公开媒体 Host | `public-media.ditedog.com` |
| 媒体 origin | `project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com` |
| 私有原图 Bucket | `project-furry-forge-private` |
| 网页衍生 Bucket | `project-furry-forge-public` |
| ECS OSS Endpoint | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 正式公开 Host | `ditedog.com`；其他精确 Host 在 T53-F1 确认 |
| 正式管理 Host | T53-F1 确认 |
| 冻结 commit/镜像 | GATE-E 填写 |

已完成：ESA NS 接入、边缘证书、ECS HTTP/80 回源限制、`public-media` 同账号私有 OSS 回源；宿主机 acme.sh、续期 cron、本地证书和 443 已卸载，Nginx 仅监听 80。

首版不做自定义边缘 URL 鉴权。ESA 到私有 OSS 的 STS 回源签名由阿里云自动完成，应用不创建、保存或刷新 STS。管理员条件上传仍直连私有 Bucket 的公网 OSS 域名。

## 2. 固定拓扑

```text
浏览器 --HTTPS--> ESA
                    |-- 页面/API --HTTP:80--> 宿主机 Nginx --> 127.0.0.1:3000 --> app
                    `-- public-media --> ESA 托管 STS 私有回源 --> 网页衍生 Bucket

管理员浏览器 --签名 PUT--> 私有 Bucket 公网 OSS 域名
app/migrate/ops --杭州内网 Endpoint--> 两只 OSS Bucket
```

两只 Bucket 上线时都设为 private 并开启 Bucket 级 Block Public Access。网页衍生 Bucket 只能放已验证、允许公开展示的派生图片；永久原图、处理源和管理预览只能在私有原图 Bucket。

## 3. GATE-E 前必须交付

- app-only Compose：唯一常驻服务是 app，端口只映射 `127.0.0.1:3000`；migrate、preflight、init、backup、restore、recover 使用同一镜像的一次性容器。
- 宿主机 Nginx 模板：只监听 80，只接受正式公开/管理精确 Host，未知 Host 返回 `421`，向应用传递受控 `X-Forwarded-Proto=https`。
- 生产配置：浏览器上传基址、OSS 内外网 Endpoint、ESA Site/API 凭据互相分离；Secret 不进仓库、镜像、日志或截图。
- ESA 精确刷新：应用使用阿里云官方 SDK 调用 `PurgeCaches(Type=file)`，保存 `TaskId`，再用 `DescribePurgeTasks` 收敛；不做全站刷新。
- 同一 SHA 通过 T49、T50，并由 GATE-E 写入唯一镜像摘要和回滚摘要。

SDK 初始化、请求和异常处理参考[阿里云 TypeScript SDK samples 的 ESA20240910 目录](https://github.com/aliyun/alibabacloud-typescript-sdk-samples/tree/main/ESA20240910)；刷新参数、返回值与任务状态以 [PurgeCaches API](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches)、[DescribePurgeTasks API](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks) 为准。

## 4. ESA 与 OSS 上线配置

1. 把临时 wildcard 路由收敛为正式公开/管理精确 Host；ESA 与 Nginx 都拒绝未知 Host。
2. 保持客户端 HTTPS 强制、ECS 回源 HTTP/80；生产启用源站保护后，ECS 80 只允许 ESA 回源地址。
3. `public-media` 保持同账号私有 OSS 回源，origin 精确指向网页衍生 Bucket。该授权由 ESA 使用 STS 完成，业务应用不参与；不要配置自定义边缘鉴权、签名查询参数、媒体鉴权 Key/TTL 或业务侧 STS。
4. 两只 Bucket 切为 private + BPA；核对历史 Object ACL、Bucket Policy、CORS 和生命周期规则。
5. 按 `deploy/esa/cache-policy.json` 的优先级配置缓存：管理 Host 与 `/api/**`/会话/写操作绕过，公开 SSR HTML 初始绕过，`/_nuxt/**` 缓存 365 天，`public-media` 的 `prod/web/**` 节点缓存 30 天、浏览器缓存 7 天并忽略全部无业务意义 query；404 缓存 60 秒，禁止源站错误或 404 时提供 stale。其他媒体路径拒绝。
6. 配置独立的 ESA API 凭据，按控制台实际支持的粒度只授予缓存刷新与任务查询所需权限；若暂不支持按 Site 收敛，记录实际权限边界。OSS 与 ESA 凭据不复用。

控制台保存后先停止写入并核对：两只 OSS 原站匿名 GET/HEAD 为 403；数据库中已发布的 `prod/web/**` 通过 `public-media` 返回 200；响应最终地址和响应头不暴露 OSS 原站；网页衍生 Bucket 全量对象与数据库 `READY + PUBLIC` 清单双向一致。任一项失败都不得靠放开 Bucket ACL、添加自定义签名或把私有对象移入网页衍生 Bucket 规避。

配置前后都运行 `pnpm run verify:esa-cache` 校验仓库基线。阶段 F 将控制台实际规则逐项抄入脱敏证据并与同一 JSON 比对；不得只凭浏览器 `Cache-Control` 判断 ESA 节点缓存，query 合并、404 TTL 和 stale 禁用还要用目标域名的冷/热请求实测。

官方依据：[ESA 私有 OSS 回源](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/use-esa-to-accelerate-oss-resource-access)、[ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)、[ESA 边缘证书](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/configure-edge-certificates/)。

## 5. 防盗刷、预算与可观测性

仓库基线是 `deploy/esa/security-observability-policy.json`，先运行：

```bash
pnpm run verify:observability
```

该基线固定以下边界：Free 只用于开发/验证，正式环境必须在 T53-F1/F2 当日确认生产套餐和配额；ESA 边缘强制 HTTPS、证书只由 ESA 托管，ECS 回源只用 HTTP/80；正式环境启用源站保护，ECS 80 只允许控制台当前列出的 ESA 融合节点 IP，app 仍只监听 `127.0.0.1:3000`。ESA 节点 IP 清单变化必须重新复核安全组，不能把旧清单永久当常量。

WAF 开启托管防护并从 observe-first 开始；管理员认证、公开统计写入和公开读取分别配置速率规则。基线只固化 Host/path/度量维度和“观察后再 block/challenge”的动作顺序，所有 QPS、错误率、延迟、流量、磁盘、证书提前量、purge 用时和费用数字保持 `null`。不得凭本机结果或经验值直接写生产阈值；T53 先测量正常流量，再把结果、误报检查和最终阈值写入脱敏证据。

目标环境页面响应、首次/重复请求、缓存证据头、请求量和受控峰值入口：

```bash
pnpm run measure:production -- \
  --target "public-home=https://${PUBLIC_HOST}/" \
  --target "public-works=https://${PUBLIC_HOST}/works" \
  --target "admin-login=https://${ADMIN_HOST}/login" \
  --target "public-media=https://public-media.ditedog.com/prod/web/EXACT-PUBLISHED-OBJECT" \
  --output .data/evidence/production-baseline.json
```

默认只做每个精确 HTTPS URL 的两轮顺序请求、HTTP→HTTPS 跳转和 ESA 边缘证书检查；只保存页面/文件响应字节、时延、状态与缓存相关响应头，不保存响应正文、Cookie、query、凭据或任意 Secret。输出把两轮写作 `first-observed` / `repeat-observed`；只有另有精确 purge 完成、全新不可变对象或控制台 cache miss 证据时，才能把首次观测标成 cold，重复请求也必须结合 ESA 节点缓存响应头/控制台指标判断，不能只看浏览器 `Cache-Control`。

受控请求量/峰值探测默认关闭。只有用户明确授权目标、请求数和并发后才运行，工具硬限制最多 100 请求、并发最多 10：

```bash
pnpm run measure:production -- \
  --target "public-home=https://${PUBLIC_HOST}/" \
  --load-target public-home \
  --load-requests MEASURED_REQUEST_COUNT \
  --load-concurrency MEASURED_CONCURRENCY \
  --allow-load-probe \
  --output .data/evidence/production-load-probe.json
```

告警清单必须逐项留证：ESA 套餐/配额、流量、源站 5xx、边缘 4xx/5xx、缓存命中、purge 失败/用时、实际公开 Host 的 ESA 托管证书；ECS 磁盘、Nginx active/config test/reload/HTTP origin、app 容器与 ready。证书告警不检查 ECS/宿主机证书，因为宿主机不应保存或终止 TLS。

预算只配置通知；不得把通知、套餐配额或用量封顶描述成无延迟的强制停费开关。月预算、通知档位、套餐配额/用量封顶是否可用及其统计延迟，都在 T53-F1/F2 按当日产品能力记录。脱敏证据从 `deploy/esa/observability-evidence.example.json` 复制到仓库外或被忽略的 `.data/evidence/` 后填写；不覆盖旧文件，不提交 Secret、控制台 Cookie、AccessKey、完整请求头或带 query 的 URL。

宿主机验证入口如下；第一条默认只读，第二条只有在第一条全 PASS 后才显式验证安全 reload：

```bash
mkdir -p .data/evidence
sudo bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST" \
  | tee .data/evidence/host-http-origin-before-reload.txt

sudo bash deploy/host/verify-http-origin.sh \
  --public-host "$PUBLIC_HOST" \
  --admin-host "$ADMIN_HOST" \
  --reload \
  | tee .data/evidence/host-http-origin-after-reload.txt
```

必须同时通过：`nginx -t`、监听 80、无监听 443、app 仅 loopback 3000、无 acme.sh/Certbot/Let’s Encrypt service/timer/process/文件、ready 200、公开/管理精确 Host 的 HTTP origin 可用。任一 FAIL 立即停止；reload 前已有 FAIL 时脚本不会 reload。管道执行时应在支持 `pipefail` 的 shell 中运行并保留脚本退出码。

官方依据：[ESA 源站保护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection)、[ESA 安全规则](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/security-rules)、[ESA 频率控制](https://help.aliyun.com/en/edge-security-acceleration/esa/user-guide/frequency-control-rules)、[ESA 缓存命中率优化](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/improve-cache-hit-ratio-on-esa)。

## 6. 部署命令

以下命令以 GATE-E 冻结产物为准；若实际 ops 入口不一致，必须回到阶段 E 修正文档和实现，不能在服务器现场改代码。

```bash
cp .env.compose.example .env
docker compose pull
docker compose run --rm --no-deps app node ops/ops.mjs migrate
# 先验证冻结变量契约；该步不访问云侧
docker compose run --rm --no-deps app node ops/ops.mjs preflight
# 只有显式 live 模式才验证并写入精确、可清理的 OSS/ESA 测试对象
docker compose run --rm --no-deps app node ops/ops.mjs preflight --no-dry-run
docker compose run --rm --no-deps app node ops/ops.mjs init-admin
docker compose up -d app
```

两次 preflight 都会创建不可覆盖的脱敏 JSON 证据。默认模式出现变量错误，或 live 模式出现 FAIL/blocked、非零退出、`exact-test-object-cleanup` 失败时，立即停止；按证据中的 run ID 只核对该次测试前缀，不执行 Bucket 清空或递归模糊删除。live 预检会调用一次精确 `PurgeCaches(Type=file)` 并轮询任务终态，因此必须在 F2 完成 Bucket/ESA/RAM 收敛后执行。

```bash
docker compose run --rm --no-deps app node ops/ops.mjs backup --output /app/backups/manual.db
docker compose run --rm --no-deps app node ops/ops.mjs restore-verify --backup /app/backups/manual.db --output /tmp/verify.db
docker compose run --rm --no-deps app node ops/ops.mjs recover-operations
```

部署后确认：Nginx `nginx -t` 通过；80 正常、443 和公网 3000 关闭；app ready；公开/管理 Host 隔离；图片可解码；浏览器上传走公网 OSS，服务端走杭州内网 OSS。

## 7. 下架、验证与回滚

下架顺序固定为：事务撤销公开投影 → 固化精确媒体 URL/Object Key → 删除无引用衍生对象 → `PurgeCaches(Type=file)` → 保存 `TaskId` → `DescribePurgeTasks` 到终态。页面下架与 ESA 缓存刷新是两个状态；失败必须保留 manifest 并可重试/重启恢复。

正式验收只保留这些结果：

- 两只原始 OSS 域名匿名读取为 403，`public-media` 能读取已发布衍生物；
- 公开 HTML/DTO 不含 OSS Bucket 域名、私有 Object Key 或 Secret；
- warm cache 下架后页面立即消失，ESA 刷新完成后旧媒体不再返回，并记录实测用时；
- 三固定视口、主要公开/管理流程、console/network、告警、备份、恢复到新路径、升级和旧镜像回滚通过。

回滚不恢复 OSS 匿名公开访问。镜像问题切回 GATE-E 记录的摘要；数据问题停止 app 后恢复到新路径并验证完整性；若需要改应用、Schema、Compose、Nginx 模板或发布镜像，停止阶段 F 并返回阶段 E。
