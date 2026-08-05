# T34-F2 · 首页业务入口合并与详情竖图修复

> 状态：实现完成，lint/typecheck/unit/integration/build/定向 E2E 均通过。commit `ae63ec2`。

## 范围

1. 首页“入口区 + 状态区”合并为统一业务入口卡（`HomeBusinessEntries.vue`）：
   - 每卡同时含图片、标题、状态（色点 + 文字 + 中文语气后缀）、一行短说明、单一行动；
   - 整卡是唯一 `<a>`，卡内没有嵌套链接；
   - 状态数据来自 `business_statuses` 表的 `detail` 字段作为 `summary`，不新增内容字段；
   - 图片来自 T34-F1 的 `home-entry-commission` / `home-entry-adoption` 无水印变体。
2. 新增聚合投影 `GET /api/public/v1/home-aggregate`：一次请求获得 hero、entries、featured、
   adoptions、statuses。非关键分区（featured/adoptions/statuses）失败时用
   `available: false` 隔离，不影响 hero 和入口卡渲染；由服务端捕获 `try/catch` 实现，
   前端不需要感知具体错误类型。
   - `public-site-repository.ts` 新增 `snapshot()` 复用：featured 和 adoptions 共享同一次
     发布作品快照构建，不重复查询。
3. 首页保留旧的分散端点（`/home`、`/commission-hero`、`/site-content`、`/adoptions`）不变，
   `index.vue` 切换为消费聚合端点；旧端点仍被 admin 和其它页面使用，未删除。
4. 详情图集竖图修复（`WorkDetailGallery.vue`）：
   - 按当前 active 图片的固有 width/height 判断方向；
   - 竖图舞台限宽居中（`max-width: min(100%, 30rem)`），不再产生两侧灰色空舞台；
   - 横图保持宽舞台但用 `object-fit: contain`，不裁切；
   - 路由复用同一组件切换作品时，`activeIndex` 按 `gallery` 的 `assetId` 序列变化重置为 0，
     避免旧索引带到图片更少的新作品上导致越界。
5. 删除 `HomeContinuation.vue`：功能被 `HomeBusinessEntries` + `HomeCurrentAdoptions` 完全
   替代，仓库内无其它引用（已用 grep 确认，仅 `.nuxt`/`.cache` 生成产物残留，随下次构建刷新）。

## 非目标

- 不改文案 Card 拆分（T34-F3）；
- 不改长任务恢复、限流（T34-F5）；
- 不引入新的分区版本化 API；
- 聚合端点不做增量缓存或 ETag，后续如有性能需求再评估。

## 验证

- `pnpm lint` / `pnpm typecheck`：通过；
- `pnpm build`：通过；
- `pnpm test`（unit）：18 files / 105 tests 通过；
- `pnpm test:integration`：12 files / 102 tests 通过（含 `public-site-contracts.test.ts` 的
  查询计数断言更新：public 7、admin 4）；
- 定向 E2E：
  - `public-home.spec.ts` T28 全部 3 个用例（含三视口截图、两卡对称性、无图/无领养隐藏）；
  - `public-works.spec.ts` 新增用例：竖图限宽居中 + 路由复用索引复位，横竖图与两次真实
    图片解码均验证。
- 两卡高度对称性：仅在 ≥768px 两列布局断言相等；<768px 单列堆叠时允许因真实文案长度
  不同而高度不同（这是预期行为，不是缺陷）。

## 已知限制

- 聚合端点与旧端点并存造成 SSR 首页请求数没有减少太多（hero/entries 走聚合，其余仍是
  独立请求路径的服务端函数调用，非独立 HTTP）；如后续要收敛为真正单一 HTTP 请求，需要
  改 `index.vue` 完全弃用旧端点，评估是否影响 admin 复用的 DTO。
- `HomeBusinessEntries` 的 3:2 图片比例对竖图设计源存在裁切；已在 T34-F1 用固定宽高矩形
  （1080×720 门槛）门控，源不够大时隐藏整卡而不是裁出低质量图。
