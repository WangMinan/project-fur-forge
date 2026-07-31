# T18 双 Bucket 发布与下架操作 · 工程记录

> 日期：2026-08-01（按批次约定保留文件名日期）
> 范围：仅工程侧发布检查、操作状态机、OSS 编排、SQLite 事务、补偿清理、API 与测试；未改写 Kimi 页面，未勾选 T18。

## API

- `GET /api/admin/v1/works/{workId}/publication-check`：返回当前 work version、阻断项、出厂照数量和需生成的 variant 数量。
- `POST /api/admin/v1/works/{workId}/publish`：`expectedVersion` 发布。
- `GET /api/admin/v1/publication-operations/{operationId}`：查询发布/下架操作状态。
- `POST /api/admin/v1/works/{workId}/unpublish`：`expectedVersion` 下架。
- `POST /api/admin/v1/publication-operations/{operationId}/retry-cleanup`：按 operation version 重试待清理的精确公开 Key。

## 发布流程

1. 先创建 `publication_operations` 意图，再校验 work version、发布状态、基础字段、至少一张 READY `studio_photo`、唯一主图和非空 alt。
2. `commission | showcase` 进入首个切片；T25 前所有 adoption 发布请求返回 `ADOPTION_FLOW_NOT_READY`，防止不完整领养数据进入 published 后使公开 mapper 抛错。
3. 对每张出厂照检查 work-card/detail 的 `recipe-v1` 全规格；缺失项调用 T16，在 OSS 完成缩放/格式/`brand-standard-v1` 水印、跨桶保存、HEAD/image-info/匿名 GET/摘要验证。
4. 网络调用完成后再次核对 WebP + fallback、宽度、Logo 摘要、profile、锚点、输出摘要和字节数。
5. 最后一个 SQLite 短事务以原 `expectedVersion` 条件更新 work 为 published、递增聚合版本、完成 operation 并写最小审计；生成期间发生并发更新则整个公开切换失败。
6. 同一原请求因响应丢失重试时返回既有 DONE operation，不重复生成；published 状态的新发布请求明确失败，当前公开状态和 READY variants 保持不变。

## 下架与补偿

- 下架先在一个 SQLite 短事务把 work 改为 unpublished，并把关联 PUBLIC variants 移出 READY 公开投影、记录完整清理清单；之后才逐 Key 删除公开 Bucket 对象。
- 每次 OSS 删除成功后用独立短事务删除对应 variant 记录并缩短清单。失败 operation 保存 `CLEANING_PUBLIC/PUBLIC_CLEANUP_FAILED` 和待处理数量；重试从剩余 Key 继续，不枚举 Bucket。
- 发布在生成/验证/提交阶段失败时，work 保持原状态；该次新生成且未引用的公开对象转为清理清单。清理成功后仍保留原发布失败状态，避免把“补偿完成”误报为“发布成功”。
- 参数/配方相同的重新发布可恢复同一确定性 variant 记录；参数变化生成新 Key。

## 安全边界

- 全流程不调用 Object ACL；私有源只传给 OSS 服务端处理接口。
- 浏览器 operation DTO 仅含类型、实体 ID、请求版本、状态、安全失败阶段/码、待清理数量和时间，不返回对象 Key、内部消息、联系人、正文、签名 URL或凭据。
- 审计只保存 actor、动作、实体、结果和时间。所有 OSS 网络调用均在 SQLite 写事务外。
- `/api/admin/**` 继续统一受 T13 Session、Host、Origin、CSRF、no-store/noindex 保护。

## 验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：13 个文件、86 项通过。
- `pnpm test:integration`：10 个文件、56 项通过。
- 新增覆盖：发布检查、12 个实际出厂照规格生成、正确水印 identity、发布幂等、已发布版本保护、提交竞态回滚与 12 Key 补偿、下架先隐藏、清理失败/重试、adoption 阻断、operation/审计泄漏扫描。

## 交接边界

T18 服务端已完成；Kimi 尚需接入发布检查、操作状态、失败阶段、清理重试、发布/下架确认和持久反馈，因此 `TASKS.md` 的 T18 保持未勾选。完整状态与请求样例将在 `T14-T18-UI-HANDOFF.md` 汇总。
