# 当前评审记录

> **冻结说明（2026-08-09）**：本文保留 2026-08-07 范围复核的原始结论，不再代表当前阶段 D 模型或生产契约。其“一图一记录、必须关联作品”等内容已被最终的“设定 + 多张返图、作品关联可选”覆盖。阶段 D 已由用户完成浏览器验收，但这不等于独立 Review；新的综合独立 Review 与同一 SHA CI 收口由 T49 执行。当前事实请读 `../STATE.md`、SPEC、PLAN 与 TASKS。

> **角色**：记录当前 SPEC、计划、代码、部署文件、GitHub Actions 与任务状态之间的差异。
> **评审日期**：2026-08-07（阶段 D 范围复核）。
> **代码基线**：`93557c38c9d3d4b0586c96bef5c05d8d369fb424`；其后的提交为阶段 D 范围收敛与文档改写。
> **结论**：阶段 C 为 `PASS`；阶段 D 规格已收敛；发布级 CI 技术债仍后置到 T49。
>
> **注意（2026-08-08）**：本文仍是**范围复核**记录，不是 T35–T37 的实施 Review。
> T35–T37 的工程主体已落地（见 `../implementation/notes/stage-d/T3*-ENGINEERING-2026-08-08.md`），
> 但**尚未经过新上下文独立 Review**。同一实现者不得为自己的实现代签，
> 因此在新的 Review 记录出现之前，不得把 T35–T37 视为已通过评审。

## 1. 总结论

阶段 C 主业务链、C.1 收口能力和用户浏览器人工验收已经完成，`GATE-C1` 通过。

本轮对阶段 D 的产品范围、材料、SPEC、PLAN、TASKS、模型、媒体策略和设计入口进行了交叉复核。当前结论：

1. **返图墙范围明确**：独立一级 `/returns`、一图一记录、必须关联作品、原比例瀑布流、无水印公开衍生、可选私有授权记录；
2. **展会掉落范围明确**：作为 adoption 的一种方式，复用作品管理，只增加展会名称和展会时间，不建设独立展会模型；
3. **范围裁剪明确**：T38、T40 取消，T39 当前版本取消并转未来备忘录，T41 并入 T36/T37；
4. **实施顺序明确**：T35 → T36 → T37 → T42；
5. **发布遗留不变**：GitHub Actions 全绿由 T49、正式环境由 T52 收口，不阻断阶段 D。

阶段 D 当前没有需要用户继续回答的业务开放问题，可以进入 T35 后端实施。

决策证据见
[`../implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md`](../implementation/notes/stage-d/STAGE-D-SCOPE-2026-08-07.md)。

## 2. 阶段 C 稳定基线

以下能力应保留，不推倒重写：

- `protection_mode`、`site-display-v1` 与作品 `recipe-v2`；
- 首页/委托 Hero 和两个业务入口的无水印 usage；
- 标准作品和领养展示位的活动水印；
- 首页聚合 DTO、统一业务入口和方向感知详情布局；
- 文案分区 Card、分区版本、FAQ 稳定 ID 与 409 草稿保留；
- 稳定 API `reason`、过期上传清扫、可信代理和按主体限流；
- publication/watermark/reconcile operation 的 attempt、lease、heartbeat、恢复和精确清理；
- `server/utils/{repository,service,runner,recipe,route}` 五层边界；
- readiness 的严格迁移数量、顺序、folderMillis 与 hash 校验；
- Node 24 镜像、Compose/Nginx、live/ready 和运维入口；
- 本地非 Docker 门禁、真实双 Bucket 9/9、三视口和用户人工验收。

## 3. 阶段 C finding 状态

### R-17 · 远端质量门禁 —— **移交 T49**

阶段迁移时核对的 `quality` 基线结果：

- `image-build` 成功；
- `checks` 的 lint、typecheck、unit、integration 成功；
- Production build 失败，后续 verify、secret scan 和 Compose 检查未执行；
- `e2e` 因依赖失败跳过。

现有证据不能推断具体根因。T49 必须以届时最新 `main` 复现、修复并取得同一 SHA 全绿。

### R-18 至 R-24 —— **已关闭或按发布阶段移交**

既有媒体 reconcile、长任务恢复、后端分层、首页/文案边界、readiness 和用户视觉验收已经关闭。Compose 正式验证和目标环境演练分别由 T49、T52 收口。

## 4. 阶段 D 规格 Review

### D-R01 · 返图页面职责 —— **PASS**

当前规格明确：

- `/returns` 是一级导航独立页面；
- 不在作品详情增加返图 Tab；
- 不建设返图详情页；
- 返图项只提供必要关联作品入口；
- 页面是作品交付后的真实使用照片墙，不是社交动态流。

这与材料中“标准作品集和买家返图墙分开”的展示目标一致，同时覆盖用户本轮明确决策。

### D-R02 · 返图模型 —— **PASS**

采用一图一记录：返图恰好关联一件作品和一张 `return_photo` 私有资产。没有相册、批次、返图 slug 或返图者账户。

可选授权来源、确认时间和备注保持私有，不进入公开 DTO、HTML、图片元数据或日志。缺失不自动阻断发布。

关联生命周期清楚：作品必须已发布才能发布返图；作品下架后公开查询隐藏返图；存在返图时阻止作品永久删除。

### D-R03 · 返图媒体 —— **PASS**

返图使用：

```text
return-wall
return-display-v1
protection_mode=none
```

公开变体保持原比例、去除不需要的 EXIF、生成 WebP/fallback、使用不可变 Key并写后验证。返图不关联活动 profile，profile 切换不改变返图。

旧文档中的“返图轻量水印”已经被用户明确否定，不得恢复。

### D-R04 · 返图 UI —— **PASS**

公开端固定使用原比例 masonry/瀑布流，稳定 DOM 与键盘顺序，底部编号分页（每页 24 条），不建设算法无限滚动，也不以“加载更多”为默认方案。

管理端使用独立返图入口、一图一记录编辑、私有原图/无水印公开预览、持续 operation 状态。作品页只显示关联摘要，不嵌入编辑器。

### D-R05 · 轻量展会掉落 —— **PASS**

底层继续使用：

```text
purpose=adoption
adoption_method=event_drop
```

只增加 `event_name`、`event_time`。复用领养状态、价格、设定图、出厂照、水印和 publication operation。展会时间只作展示，不自动驱动状态。

没有 `events` 表、展会管理页、展会详情、地点、摊位、封面或归档。

### D-R06 · 公开展会呈现 —— **PASS**

`/adoptions` 提供全部/常规领养/展会掉落筛选；首页当前领养和作品详情显示展会名称与时间；不增加独立“当前展会”区块或一级导航。

### D-R07 · 范围裁剪 —— **PASS**

- T38 取消，不扩张内容 Card 或通用 CMS；
- T39 当前取消，未来与分享、OG、海报、二维码和 canonical 统一决策；
- T40 取消，不建立数据库/OSS 联动回收站；
- T41 并入 T36/T37，不建设通用手机后台。

任务清单保留编号并明确“未实施”，取消项不进入 T42。

## 5. T35 Review 检查项

T35 独立 Review 必须检查：

- 新迁移不重写历史 migration；
- 一条返图恰好一张 `return_photo`；
- 资产唯一关联和非法角色被拒绝；
- 返图必须关联现有作品；
- 授权字段不进入公开 DTO、日志、异常和测试 artifact；
- 作品发布约束、下架后公开隐藏和删除阻断；
- 版本冲突不静默覆盖；
- 迁移、备份副本、integrity、foreign key 和 readiness；
- 代码仍遵守 repository/service/runner/recipe/route 边界。

T35 不应提前完成或假装完成 `/returns` UI 和媒体 publication；这些属于 T36。

## 6. T36 Review 检查项

- 私有返图原图匿名不可读；
- 公开返图变体匿名可读且无水印；
- 敏感 EXIF、私有 Key和授权记录不泄漏；
- profile 切换不影响返图；
- 生成/验证/提交中断、失败清理、重复重启和旧公开版本保留；
- `/returns` 一级导航、瀑布流、分页、真实空态和关联作品入口；
- 作品详情没有返图 Tab；
- 管理端上传、alt、授权提示、发布、下架、409 和恢复；
- 三视口、键盘、焦点、图片解码、CLS、console/network；
- 手机约定轻操作真实可用。

## 7. T37 Review 检查项

- 管理四选项正确映射三种 purpose 与 adoption_method；
- event_drop 两项展会字段必填，其他作品字段为空；
- 时间不触发定时任务或自动状态；
- 领养状态、价格、设定图、出厂照和水印复用；
- `/adoptions` 筛选、首页、卡片和详情一致；
- 没有 event 实体、路由、媒体、导航或空页面；
- 手机字段维护和发布可用；
- Schema、数据库 CHECK、service 与前端校验一致。

## 8. 阶段 D 通过条件

T42 只验证 T35–T37：

- 当前活文档和代码一致；
- 迁移、数据、媒体、隐私、发布、失败和恢复有证据；
- 真实双 Bucket 与相关自动化通过；
- 三固定视口真实浏览器通过；
- 新上下文独立 Review PASS；
- 用户完成业务与视觉验收。

T38–T41 不构成缺口。

## 9. 后续发布条件

### T49

- 最新 `main` Production build 失败被复现和修复；
- verify、secret scan 与 Compose 检查真实执行；
- `checks`、`image-build`、`e2e` 同一 SHA 成功；
- 不通过删除测试或放宽类型、安全、媒体和 E2E 断言取得绿色状态。

### T52–T53

完成正式域名、TLS、线上 Compose、空卷初始化、备份、监控、升级、回滚、恢复演练，以及景宸真实使用验收和文档闭环。
