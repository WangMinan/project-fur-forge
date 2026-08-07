# 执行责任路由

> **角色**：记录阶段 D 的执行顺序、写入边界和交接要求。
> **最后校准**：2026-08-07。
> **当前门禁**：阶段 C 与 `GATE-C1` 已通过；阶段 D 范围已锁定，下一项为 T35。

## 1. 当前角色

| 角色 | 责任 |
| --- | --- |
| `BACKEND_PRIMARY` | 数据库、Schema、API、媒体、operation、恢复和公开投影 |
| `FRONTEND_PRIMARY` | Vue 页面、组件、状态、响应式、无障碍和视觉接线 |
| `REVIEW` | 契约、代码、浏览器、媒体、安全、性能和证据复核 |
| `ACCEPTANCE` | 用户最终业务与视觉确认，负责阶段门禁签署 |

默认分工：

- GPT-5.6 Sol：`BACKEND_PRIMARY`，并可在新的独立上下文承担 `REVIEW`；
- 前端由用户在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中指定；
- 同一实现者不能为自己的工作代签 Review；
- 联合任务按后端 → 前端 → Review → 用户验收串行推进。

## 2. 当前起点

阶段 C 已形成稳定基线：完整作品/领养/首页/委托/信息页、双 Bucket、站点无水印与作品水印、角色化上传、发布与下架、分区文案、operation 恢复、五层后端边界、Node 24 镜像和部署配置。

后端层次保持：

```text
server/utils/{repository,service,runner,recipe,route}/
```

`server/routes/` 是 Nitro 文件路由；`server/utils/route/` 是 handler 辅助层，不得合并。

## 3. 当前授权范围

允许实施：

1. T35：返图模型、作品关联、版本、状态和可选私有授权记录；
2. T36：返图上传、无水印公开衍生、后台和独立 `/returns` 瀑布流；
3. T37：复用作品与领养管理的轻量展会掉落；
4. T42：只验收 T35–T37。

禁止恢复：

- T38 更多站点文字内容；
- T39 当前版本 slug 改址历史；
- T40 30 天回收站；
- T41 独立通用手机后台。

不得为取消项预建表、JSON 字段、路由、页面、导航、通用重定向、统一 `deleted_at` 或到期清理任务。

## 4. T35 执行顺序

### 4.1 BACKEND_PRIMARY

1. 读取当前 SPEC、PLAN、TASKS、模型和媒体策略；
2. 新增前向迁移，不修改历史迁移；
3. 实现一图一记录 `return_photos` 与唯一资产关联；
4. 增加 `return_photo` 角色所需共享枚举和上传归属准备，但 T35 不提前完成 T36 媒体发布；
5. 实现管理/公开 Schema、稳定 `reason`、repository/service/route；
6. 保证授权记录仅管理可见；
7. 保证关联作品发布约束、作品下架后的公开隐藏和作品删除阻断；
8. 完成迁移、版本、非法关联、隐私和状态测试；
9. 写 T35 实施 note 并同步活文档中的已落地事实。

### 4.2 REVIEW

独立 Review 至少检查：

- 一条返图恰好一张资产，没有相册层级；
- `return_photo` 不能冒充 `studio_photo`；
- 授权字段不进入公开 DTO、日志、异常和测试 artifact；
- 作品未发布时返图不能发布；
- 作品下架时公开查询隐藏返图；
- 存在返图时作品永久删除被阻止；
- 版本冲突不会静默覆盖；
- 迁移与 readiness 边界正确。

Review 为 PASS 后才能进入 T36。

## 5. T36 执行顺序

### 5.1 媒体与发布后端

`BACKEND_PRIMARY` 完成：

1. `return_photo` 条件 PUT 私有直传和完成核验；
2. `return-wall` / `return-display-v1` / `protection_mode=none`；
3. 原比例 WebP/fallback SourceSet 和 EXIF 收敛；
4. 不关联活动水印 profile，不复用作品 `recipe-v2`；
5. publication operation、attempt、lease、heartbeat、失败清理和启动恢复；
6. 公开分页查询，只返回返图与作品均 published 的记录；
7. 双 Bucket、匿名访问、敏感 EXIF、SIGKILL、重复重启和幂等测试；
8. 写后端实施 note 和契约交接。

不得新建第二套上传器、第二套公开 URL 生成规则或第二套 operation 状态机。

### 5.2 FRONTEND_PRIMARY

在后端契约稳定后完成：

1. `/admin/returns` 列表；
2. 新建和编辑一图一记录返图；
3. 关联作品、单图上传、alt、排序和可选授权记录；
4. 私有原图预览与无水印公开预览；
5. 发布、下架、持续进度、失败、刷新恢复和 409 草稿保留；
6. 公开一级导航 `/returns`；
7. 原比例 masonry/瀑布流、分页或加载更多、真实空态和关联作品入口；
8. 手机查看、选择作品、单图上传、alt、授权文字、发布和下架；
9. 三视口、键盘、焦点、图片解码、减少动效、CLS 和无横向溢出。

明确禁止：

- 作品详情返图 Tab；
- 返图详情页；
- 返图水印或水印开关；
- 返图者昵称/主页；
- 点赞、评论、搜索、公开投稿或访客账户；
- 回收站入口。

### 5.3 REVIEW 与 ACCEPTANCE

Review 至少检查：

- 返图公开对象无水印且不含敏感 EXIF；
- 私有原图和授权记录不进入公开 DTO、DOM、日志或缓存；
- profile 切换不影响返图；
- 关联作品下架后的公开隐藏；
- 发布失败和重启不破坏旧公开版本；
- masonry 的 DOM/焦点顺序、分页和三视口；
- 管理与公开 Host 隔离；
- 页面真实点击与图片内容，不只看用例数量。

Review PASS 后由用户执行 T36 人工验收。

## 6. T37 执行顺序

### 6.1 BACKEND_PRIMARY

1. 新前向迁移或启用现有 event_drop 兼容字段；
2. `works` 增加/规范 `event_name`、`event_time`；
3. 数据库 CHECK、共享 Schema 和 service 校验保持一致；
4. event_drop 使用 `purpose=adoption`、`adoption_method=event_drop`；
5. 发布检查增加展会字段，不增加 event operation；
6. 公开作品/领养 DTO 增加展会名称和时间；
7. 首页当前领养和 `/adoptions` 查询包含 regular 与 event_drop；
8. 非 event_drop 清理/拒绝残留展会字段；
9. 迁移、状态、发布、隐私和查询测试。

不得创建 `events`、`event_works`、展会 slug、展会媒体或“当前展会”全局表。

### 6.2 FRONTEND_PRIMARY

1. 作品业务类型显示委托/常规领养/展会掉落/纯展示；
2. 正确映射到三种 purpose 与 adoption_method；
3. event_drop 显示展会名称、展会时间、状态、价格和现有媒体；
4. 类型切换清理展会字段并明确提示；
5. `/adoptions` 增加全部/常规领养/展会掉落筛选；
6. 领养卡、首页当前领养和详情显示一致展会信息；
7. 手机支持展会字段、发布和下架；
8. 不增加独立展会导航、页面、封面、地点或时间线。

### 6.3 REVIEW 与 ACCEPTANCE

Review 检查四选项映射、字段 CHECK、媒体复用、水印、首页/列表/详情、时间不自动驱动状态、SEO 与三视口。PASS 后由用户验收。

## 7. T42 阶段 D 收口

T42 只依赖 T35–T37：

- 文档、模型、媒体策略和代码一致；
- 迁移与恢复正确；
- 返图隐私、无水印媒体和 operation 通过；
- 展会掉落复用领养且没有独立展会系统；
- 三视口、自动化、双 Bucket、失败和重启证据完整；
- 独立 Review PASS；
- 用户完成业务与视觉验收。

T38–T41 不构成隐式阻断。

## 8. GitHub Actions 处理边界

已知 `quality` 状态：`image-build` 成功，`checks` 在 Production build 失败，`e2e` 跳过。该故障属于 T49，不阻断 T35–T37。

阶段 D 实现者必须运行相关本地门禁并如实记录，但：

- 不得把本地通过写成远端全绿；
- 不得顺手扩大范围修复整个流水线，除非用户授权；
- 不得删除测试、放宽类型、安全、媒体或 E2E 断言；
- 不得拼接不同 SHA 的成功结果；
- 不得把 `e2e skipped` 记为成功。

## 9. 写入纪律

- 基于最新 `main` 串行推进；
- 小提交、可回滚，提交信息带 T35/T36/T37；
- 不 force push、不硬 reset；
- 不删除或清空 `.env`；
- 不重写历史迁移；
- 不公开原图、授权记录或敏感 EXIF；
- 不通过错误水印/无水印行为让测试通过；
- 不创建 `v*` tag，不触发正式镜像发布；
- T35 Review 前不并行写 T36；T36 稳定前不建议推进 T37 UI。

## 10. 文档交接

每项至少更新：

- `../STATE.md`；
- `TASKS.md`；
- `../planning/PLAN.md`；
- `../requirements/SPEC.md` 中实际变化的业务事实；
- `../requirements/MEDIA-PUBLICATION-POLICY.md` 中实际媒体行为；
- `../models/README.md` 中实际落地模型；
- 对应 `implementation/notes/` 实施与 Review 记录。

实施记录包含范围、非目标、迁移、首次失败、findings、修复、命令、浏览器证据和未验证边界。测试数量不能替代真实页面、媒体和重启恢复观察。

阶段 D 完成后仍不能自动宣布正式上线。GitHub Actions 全绿由 T49 负责，正式域名、TLS、线上 Compose、升级、回滚和恢复演练由 T52 负责。