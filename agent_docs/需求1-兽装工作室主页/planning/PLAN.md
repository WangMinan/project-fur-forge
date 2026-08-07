# 实施计划

> **角色**：描述当前阶段仍有效的技术方案、执行顺序与边界。
> **最后更新**：2026-08-07。
> **当前阶段**：阶段 D · P1 一期增强，范围已锁定为 T35、T36、T37、T42。

## 1. 稳定技术基线

阶段 C 已完成并经用户浏览器人工验收。阶段 D 继续复用：

- Nuxt 4、Vue 3、Nitro、Node.js 24、pnpm 11；
- SQLite + Drizzle，单实例、单写者；
- 阿里云 OSS 私有原图 Bucket + 公开衍生图 Bucket；
- 公开 Host 与管理 Host 严格隔离；
- 永久原图和返图授权记录私有，公开页只消费预生成、验证完成的衍生图；
- `server/utils/{repository,service,runner,recipe,route}/` 五层边界；
- 持久 operation、attempt、lease、heartbeat、失败清理与启动恢复；
- 资源版本和 409 冲突，不静默覆盖；
- 迁移、备份、readiness 和 migration hash 严格校验；
- Docker 镜像由 GitHub Actions 构建，正式域名、TLS、线上 Compose、升级与回滚演练留到 T52。

媒体规则以 [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源。

## 2. 阶段 D 产品范围

阶段 D 只交付：

1. T35：一图一记录的返图模型和可选私有授权记录；
2. T36：返图私有上传、无水印公开衍生、管理端和独立 `/returns` 瀑布流；
3. T37：复用作品与领养管理的轻量展会掉落；
4. T42：对 T35–T37 做总门禁和用户验收。

范围裁剪：

- T38 取消，不扩张更多站点文字内容；
- T39 当前版本取消，分享与 URL 策略记入 [`FUTURE-ITERATIONS.md`](./FUTURE-ITERATIONS.md)；
- T40 取消，不建设数据库与 OSS 联动的 30 天回收站；
- T41 不再单列，必要手机能力并入 T36、T37。

## 3. T35 · 返图模型与契约

### 3.1 数据模型

推荐新增 `return_photos`，一张公开返图对应一行：

```text
id
work_id
asset_id
alt
sort_order
publication_status
authorization_source        nullable
authorization_confirmed_at  nullable
authorization_note          nullable
version
created_at
updated_at
published_at                nullable
```

约束：

- `work_id` 必须引用现有作品；
- `asset_id` 必须引用 READY `return_photo` 私有资产，且不能被另一条返图重复占用；
- alt 非空；
- 状态只允许 `draft | published | unpublished`；
- 只有关联作品已发布时，返图才能发布；
- 公开查询同时要求返图和作品已发布；
- 授权字段全部为可选私有字段，不进入公开投影；
- 不增加 `return_albums`、批次、返图详情页或返图者账户。

一图一记录后不需要额外 `return_assets` 多图关系。若实现层因现有媒体关联框架需要独立关系表，也必须保持“一条返图恰好一张资产”的唯一约束，不能悄然扩成相册。

### 3.2 作品删除与下架

- 存在返图关联时阻止作品永久删除；
- 作品下架后，公开查询自然隐藏关联返图，不批量改写返图状态；
- 阶段 D 完整支持返图下架；
- 不建设通用回收站；
- 永久删除不作为 T35–T36 的必做管理入口；
- 若保留草稿删除能力，必须明确不可恢复并精确清理当前记录独占对象。

### 3.3 契约与服务

新增：

- Drizzle schema 与新的前向迁移；
- 管理请求/响应 Schema；
- 公开返图 DTO；
- 稳定业务 `reason`；
- repository、service、route；
- 作品关联、状态、排序、版本与隐私测试。

公开 DTO 只包含 READY SourceSet、宽高、alt，以及关联作品的公开名称、slug、href；不包含授权记录、私有 Key、签名 URL、原文件名或 EXIF。

### 3.4 T35 Review 门禁

进入 T36 前必须确认：

- 历史迁移未重写；
- 一图一记录约束真实落到数据库；
- 非法作品/资产关联被拒绝；
- 版本冲突不会静默覆盖；
- 授权记录不进入公开 DTO、日志和测试 artifact；
- 已发布作品约束和作品下架后的公开隐藏行为有测试；
- 当前活文档与迁移一致。

## 4. T36 · 返图媒体、发布与 `/returns`

### 4.1 私有上传

复用现有条件 PUT 上传链：

- 上传会话使用严格 `return_photo` 角色和返图归属；
- 浏览器直传私有 Bucket；
- 服务端重验摘要、MIME、尺寸、字节数、EXIF 方向和归属版本；
- 失败重试创建新会话和新 Key；
- 过期会话沿用现有清扫；
- 私有 Object Key 和签名 URL不进入普通管理 JSON 或日志。

### 4.2 无水印公开配方

新增返图公开身份：

```text
usage = return-wall
recipe_version = return-display-v1
protection_mode = none
```

要求：

- 不关联活动水印 profile；
- 不叠加 Logo，不提供逐图水印开关；
- 去除不需要的 EXIF，尤其是拍摄位置和设备隐私；
- 保持原始宽高比；
- 生成适合瀑布流的 WebP 与 JPEG/PNG fallback SourceSet；
- 使用完整身份寻址的不可变 Object Key；
- 写入后验证 MIME、尺寸、字节数、摘要和匿名读取；
- profile 切换不重新生成、切换或删除返图变体。

返图配方可以复用现有 variant repository、对象验证、失败清理和公开投影基础设施，但不能复用作品 `recipe-v2` 的水印身份。

### 4.3 发布与恢复

返图发布沿用原子模式：

1. 固化返图和关联作品版本；
2. 生成缺失的 `return-wall` 变体；
3. 验证公开对象；
4. 原子切换返图状态和公开投影；
5. 写入审计记录；
6. 失败只清理当前 attempt 新建对象，保留旧公开版本。

publication operation 使用现有 attempt、lease、heartbeat、recovery reason、提交 CAS 和启动恢复。测试必须覆盖生成、验证、提交边界的中断、重复重启、旧公开版本保留和精确清理。

### 4.4 管理端

新增独立返图列表与编辑页：

- 列表按作品和发布状态筛选；
- 一条记录只编辑一张返图；
- 选择关联作品、上传、填写 alt、调整排序；
- 可选授权记录明确标注“仅后台可见”；
- 显示私有原图预览与无水印公开预览的区别；
- 显示发布检查、持续进度、失败、重试、刷新恢复和下架；
- 409 保留草稿并允许重载最新服务端值；
- 不显示水印参数、返图者主页或回收站入口。

作品编辑页最多显示关联返图数量和前往返图管理的普通入口，不嵌入返图编辑器。

### 4.5 公开 `/returns`

公开站增加一级导航 `/returns`：

- 页面使用真实图片原比例瀑布流；
- 不建设作品详情内返图 Tab；
- 不建设返图详情页；
- 每项只保留关联作品名称或链接等必要信息；
- 使用稳定 DOM 顺序，视觉 masonry 不破坏键盘和屏幕阅读顺序；
- 图片声明固有宽高，避免 CLS；
- 使用底部编号分页（普通链接、SSR 与无 JS 可用），不建设算法无限滚动，
  也不以“加载更多”为默认方案；
- 单图坏图或局部接口异常使用受控降级；
- 无返图时显示真实空态；
- 不提供搜索、点赞、评论、投稿、用户账号或社交时间线。

### 4.6 手机能力并入 T36

手机端至少能：

- 查看返图列表与状态；
- 创建一条返图；
- 选择关联作品；
- 单图上传；
- 编辑 alt 和可选授权文本；
- 发布、下架和查看失败/恢复状态。

不增加独立 T41，也不为手机强行实现批量排序、批量上传或复杂焦点编辑。

## 5. T37 · 轻量展会掉落

### 5.1 领域复用

底层保持三种 purpose。展会掉落使用：

```text
purpose = adoption
adoption_method = event_drop
```

管理端业务选择可以呈现四项，但只做映射，不增加 `purpose=drop`。

### 5.2 数据字段

在 `works` 增加或启用：

```text
event_name  nullable
event_time  nullable
```

约束：

- event_drop 两项必填、去除首尾空白且非空；
- 非 event_drop 两项为空；
- `event_time` 是展示文本，不参与调度；
- 一件作品当前只保存一组展会信息。

不创建 `events`、`event_works`、展会 slug 或展会媒体表。

### 5.3 发布链复用

展会掉落继续复用：

- 领养价格和状态；
- 横版设定图与出厂照；
- 活动作品水印；
- 发布、下架、清理、operation 和审计；
- 统一作品详情和 `/works` 投影。

发布前增加展会字段检查。展会时间不会自动把状态从 `scheduled` 改为 `available`，也不会触发定时任务。

### 5.4 管理端

作品编辑器：

- 显示“委托作品 / 常规领养 / 展会掉落 / 纯展示”；
- 选择展会掉落后显示展会名称、展会时间；
- 同时显示领养状态、价格、设定图和出厂照；
- 切换离开展会掉落时清理或拒绝残留展会字段；
- 发布检查明确缺失字段；
- 手机端可以编辑两项短文本和完成发布/下架。

不增加“当前展会”导航或管理页面。

### 5.5 公开端

`/adoptions` 同时展示 regular 与 event_drop，并提供：

```text
全部
常规领养
展会掉落
```

展会掉落卡片与详情显示：

- 展会掉落标签；
- 展会名称；
- 展会时间；
- 当前领养状态；
- 可选价格。

首页“当前领养”可以包含掉落，并展示同样的简短展会信息。不增加独立展会页、展会首页区块、地点、摊位、主办方或历史归档。

### 5.6 T37 Review

至少验证：

- UI 四选项到领域字段的映射；
- 数据库 CHECK、共享 Schema 和服务校验一致；
- 非掉落作品不能残留展会字段；
- event_drop 复用领养媒体、水印、价格和状态；
- 公开筛选、首页、详情和 SEO 信息正确；
- 展会时间不触发自动状态变化；
- 未创建独立展会模型、路由或空导航。

## 6. 推荐执行顺序

### 第一段：T35 后端与独立 Review

1. 新前向迁移和 Drizzle schema；
2. `return_photos`、约束、索引和 fixture；
3. 管理/公开契约、repository、service、route；
4. 隐私、版本、关联和状态测试；
5. 独立 Review 通过后进入 T36。

### 第二段：T36 媒体与发布后端

1. `return_photo` 上传会话与核验；
2. `return-display-v1` 无水印 recipe/identity；
3. publication runner、恢复和精确清理；
4. 公开分页查询；
5. 双 Bucket、失败、SIGKILL 和幂等证据。

### 第三段：T36 管理端与公开端

1. 管理端返图列表和编辑；
2. 上传、alt、排序、授权提示、预览、发布和下架；
3. 一级导航 `/returns` 与原比例瀑布流；
4. 手机轻量维护；
5. 三视口、可访问性、console/network 与图片解码；
6. 独立 Review 与用户验收。

### 第四段：T37 前后端

1. works 前向迁移与约束；
2. 管理表单四选项映射与展会字段；
3. 现有发布检查和公开 DTO 扩展；
4. `/adoptions` 筛选、首页与详情展示；
5. 手机、测试、独立 Review 和用户验收。

### 第五段：T42

只验收 T35–T37。T38、T39、T40、T41 不构成依赖或缺口。

## 7. 迁移、备份与 readiness

- 不修改已经执行的历史迁移；
- 所有模型变化使用新的前向迁移；
- 同步更新 Drizzle schema、迁移元数据、约束、索引和测试 fixture；
- 迁移前创建验证备份，在副本执行 integrity、foreign key 和 migration hash 校验；
- readiness 继续比较迁移数量、顺序、folderMillis 与 hash；
- readiness 不高频轮询 OSS，真实 Bucket 权限放在 preflight 和门禁测试。

## 8. GitHub Actions 与发布边界

已知远端遗留仍由 T49 处理，不阻断阶段 D。阶段 D 每个任务仍需运行相关 lint、typecheck、unit、integration、build 和 E2E，并如实记录本地与远端差异。

不得把本地结果写成远端全绿；不得删除测试或放宽类型、安全、媒体和 E2E 断言；不得拼接不同 SHA 的结果。

正式域名、TLS、线上 Compose、Docker Hub 发布、升级、回滚和恢复演练不属于阶段 D。

## 9. 明确非目标

阶段 D 不实现：

- 万能 CMS、更多受限文字 Card 或任意 HTML；
- slug 改址历史、通用重定向引擎和分享海报；
- 30 天回收站、统一软删除和跨 OSS 到期清理；
- 独立展会实体、展会管理页、展会详情、地点、摊位或归档；
- 返图水印、返图者主页、返图详情、公开投稿、点赞、评论或访客账户；
- 多管理员、RBAC、多实例、消息队列或自动 worker；
- 为未来功能预建通用空表、空路由或空导航。