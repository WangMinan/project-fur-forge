# T52-E4 工程记录（2026-08-10）

## 结论

T52-E4 已完成工程实现与本地门禁，可以继续 T52-E5。该结论不代表真实 ESA 控制台缓存已按基线配置，也不代表目标环境 purge 时限已实测；这两项仍属于 T53。T49 的新上下文独立 Review 保持开放。

用户确认的英文品牌继续保持完整 `DITE DOG FURSUIT`。本任务未修改品牌常量，只保留并重放完整名称断言。

## 实现

- 新增前向迁移 `0026_t52_e4_edge_purge.sql`，在既有 `publication_operations` 上保存精确 ESA URL manifest、TaskId、`NOT_REQUIRED/PENDING/PURGING/COMPLETE/FAILED` 状态、稳定 reason 与最后查询时间；没有新建第二套任务表或常驻 worker。
- 使用阿里云 ESA 2024-09-10 官方 TypeScript SDK 调用 `PurgeCaches(Type=file)`；每次只接受 1～1000 个唯一的 `https://public-media.ditedog.com/prod/web/**` 精确文件 URL，拒绝 query、fragment、目录、其他 Host/前缀和全站/前缀 purge。
- `DescribePurgeTasks` 使用 Site、`type=file` 和首个精确 URL 的 content 过滤，再按 TaskId 收敛 `Refreshing/Complete/Failed`。提交、查询、任务缺失、失败和超时都保存稳定失败码。
- 作品、返图、首页与委托 Hero 的下架都先事务撤销公开投影并固化清单，再逐个删除 OSS 对象，最后提交/查询 ESA purge。失败重试和启动恢复不重复改变作品、返图或首页版本。
- 管理端分别显示“页面已隐藏”“删除公开文件中”“ESA 缓存撤销中”“已撤销”“撤销失败”，并为作品、返图和 Hero 暴露安全的重试入口；不显示 URL manifest、TaskId、Object Key 或 SDK 错误正文。
- `deploy/esa/cache-policy.json` 冻结六条有序规则：管理/API/会话/写操作绕过、公开 SSR HTML 初始绕过、`/_nuxt/**` 365 天、媒体节点 30 天/浏览器 7 天、忽略无业务 query、404 60 秒、禁用 stale、拒绝其他媒体路径。`pnpm run verify:esa-cache` 提供机器校验入口。
- 新增 Alibaba Cloud OpenAPI Core 的直接生产依赖和 ISC 许可说明。production build 的 `.output/server/package.json` 已包含 ESA SDK、OpenAPI Core 及其运行时依赖。

## 验证

| 命令/检查 | 结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `APP_ENV=test pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `pnpm run verify:esa-cache` | PASS |
| `APP_ENV=test pnpm test` | PASS，26 files / 148 tests |
| `APP_ENV=test pnpm test:integration` | 首次受 120 秒命令上限终止，不计结果；提高上限后从头 PASS，20 files / 168 tests |
| E4 定向作品发布/撤销 | PASS，15 tests；含 purge 中、失败、重试、启动恢复且不重复业务写入 |
| E4 定向返图管理 | PASS，17 tests；含精确 ESA URL 撤销 |
| E4 定向公开站/Home | PASS，7 tests；含页面先隐藏、purge 中与终态 |
| E4 定向数据库约束 | PASS，14 tests；含迁移列、索引与状态约束 |
| `APP_ENV=production pnpm build` | PASS；Nitro 正式输出包含 ESA SDK 运行时依赖 |
| `APP_ENV=production pnpm run verify:production` | PASS；health、公开 SSR、管理 CSR |
| Playwright `admin-home` 启用/停用定向用例 | PASS，1/1；管理轮询与公开 Host 移除均通过 |

## 未在本任务冒充完成的事项

- 未使用真实 ESA/OSS Secret，没有对 Bucket、ESA、DNS 或服务器做写操作；
- 未把本地 fake purge 的完成时间写成生产 SLA；
- 未验证目标域名 warm cache、随机 query 合并、404 TTL 或 stale 行为；这些按 Handbook 在 T53 记录真实请求证据；
- 未执行 T49 同一 SHA Actions 或独立 Review，也未关闭 T50/GATE-E。

官方接口依据：

- [PurgeCaches](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-purgecaches)
- [DescribePurgeTasks](https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-describepurgetasks)
