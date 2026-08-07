# 状态

> **角色**：当前需求的状态机与执行入口。只记录现在有效的阶段、阻断项和下一步；历史过程见 `implementation/notes/`。
> **最后更新**：2026-08-07。
> **阶段 D 文档基线**：`93557c38c9d3d4b0586c96bef5c05d8d369fb424`；其后的提交为本次范围收敛与文档改写。

## 当前阶段

阶段 C 与阶段 C.1 已完成，`GATE-C1` 已通过。项目现进入：

> **阶段 D · P1 一期增强实施，下一项为 T35。**

阶段 D 范围已经确认，不再处于需求讨论状态：

1. T35：返图模型、作品关联、状态、版本与可选私有授权记录；
2. T36：返图私有上传、无水印公开衍生、管理端和独立 `/returns` 原比例瀑布流；
3. T37：复用作品与领养管理的轻量展会掉落；
4. T42：只对 T35–T37 做阶段门禁和用户验收。

T38、T40 已取消；T39 当前版本取消并转未来迭代备忘录；T41 不再单列，必要手机能力并入 T36、T37。

阶段 C 的用户验收见
[`implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md`](./implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md)。
阶段 D 范围决策见
[`implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md`](./implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md)。

## 阶段 C 已交付基线

以下能力继续有效，不在阶段 D 推倒重写：

- 完整作品字段、设定图、出厂照、作品发布与下架；
- 常规领养列表与统一作品详情；
- 首页 Hero、精选作品、统一业务入口和当前领养；
- 委托页、关于、官方渠道、服务条款、隐私政策与营业状态；
- 首页和委托站点展示位无水印，作品与领养展示位保留活动水印；
- 可配置居中水印 profile 与真实双 Bucket 验证；
- 分区文案 Card、稳定 FAQ ID 和分区级并发冲突处理；
- 过期上传清扫、可信代理、按主体限流和稳定业务错误；
- publication/watermark/reconcile 长任务的 lease、heartbeat、恢复与幂等；
- Node 24 镜像结构、Compose/Nginx 配置、live/ready 与运维子命令；
- 本地非 Docker 门禁、三视口浏览器检查和用户人工验收。

媒体公开规则继续以
[`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md)
为唯一事实源。

## 阶段 D 已锁定产品事实

### 返图墙

- `/returns` 是公开站一级导航独立页面，不是作品详情内的 Tab；
- 一张返图对应一条记录，必须关联现有作品和一张 `return_photo` 私有原图；
- 公开端采用原比例 masonry/瀑布流；
- 返图公开图不加水印，使用独立无水印预生成衍生图；
- 私有原图、私有 Object Key、EXIF 隐私和可选授权记录不进入公开响应；
- 首版不建设返图详情、返图者主页、搜索、点赞、评论、访客投稿或用户账号；
- 作品下架后关联返图从公开查询隐藏；存在返图关联时阻止作品永久删除；
- 不建设返图或全站 30 天回收站。

### 轻量展会掉落

- 底层保持 `purpose=adoption`、`adoption_method=event_drop`；
- 管理端可以显示四个业务选项，但不新增第四种底层 purpose；
- event_drop 只要求展会名称 `event_name` 和展会时间展示文本 `event_time`；
- 复用领养状态、价格、设定图、出厂照、作品水印、发布和下架；
- `/adoptions` 提供全部/常规领养/展会掉落筛选；首页和详情显示展会名称与时间；
- 展会时间不自动改变业务状态；
- 不创建独立展会表、展会管理页、展会详情、地点、摊位、封面或历史归档。

## 当前任务状态

| 任务 | 当前状态 | 下一步 |
| --- | --- | --- |
| T35 | **可开始** | 新前向迁移、一图一记录模型、管理/公开契约、隐私与版本测试 |
| T36 | **等待 T35** | `return_photo` 上传、无水印公开配方、operation、后台与 `/returns` |
| T37 | **范围已确认** | 建议在 T36 稳定后扩展现有 works 和 adoption 链路 |
| T38 | **已取消，未实施** | 不进入 T42 |
| T39 | **当前版本取消，未实施** | 未来与分享、OG、海报或二维码统一讨论 |
| T40 | **已取消，未实施** | 不进入 T42 |
| T41 | **取消独立任务** | 手机能力并入 T36、T37 |
| T42 | **等待 T35–T37** | 阶段 D 总门禁 |

未来候选见 [`planning/FUTURE-ITERATIONS.md`](./planning/FUTURE-ITERATIONS.md)。该文件不是实施授权。

## GitHub Actions 非阻断遗留

阶段 C 迁移时核对的代码基线 `3984b4f181d5a3071a119affae34c1088a53b6f9` 的 `quality` 结果为：

- `image-build`：成功；
- `checks`：lint、typecheck、unit、integration 成功后，在 Production build 失败；
- `e2e`：因依赖 `checks` 而跳过。

现有证据不足以在文档中断言具体根因。该问题已登记到阶段 E 的 T49，由届时最新 `main` 复现、修复并取得 `checks`、`image-build`、`e2e` 同一 SHA 全绿。

在 T49 完成前不得声称 GitHub Actions 已全绿；它不阻断 T35–T37。

## 下一步执行顺序

1. T35 后端：返图迁移、Drizzle schema、共享契约、repository/service/route 和测试；
2. 新上下文独立 Review T35，确认一图一记录、关联、版本和隐私；
3. T36 后端：`return_photo` 上传、`return-display-v1` 无水印配方、发布恢复和公开分页；
4. T36 前端：独立返图管理、一级导航 `/returns` 瀑布流和手机轻操作；
5. 独立 Review 与用户验收 T36；
6. T37 前后端：展会字段、管理四选项映射、发布检查、领养筛选、首页和详情；
7. 独立 Review 与用户验收 T37；
8. T42 阶段 D 总门禁；
9. T49、T50、T52 再完成发布级 CI、最终浏览器和正式环境收口。

## 当前发布边界

- 当前没有正式域名，不生成证书、不启用 HSTS、不声称完成 TLS；
- 不创建 `v*` tag，不触发 Docker Hub 正式发布，不远程部署；
- 本地测试不能替代后续正式环境演练；
- 阶段 D 可以继续开发，但 T49、T50、T52 未完成前不得宣布正式上线就绪。