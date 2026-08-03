# T08 评审记录：生产视觉方向门禁（已通过）

> **状态**：用户于 2026-07-30 完成最终验收。**T08 已通过，`must-fix = 0`**，TASKS.md 中 T08 已勾选。
> **范围**：T05 首页 + T06 作品列表/详情 + T07 管理端工作台。
> **最终结论**：横向精选轨道为首页最终方案；T06/T07 视觉基线通过；C1、C3–C5 接受现状；C2 已修复。

## 1. 三视口截图索引（`notes/t01-t09/t06-t07/screenshots/`）

视口固定为 390×844 / 768×1024 / 1440×900；`full` 为整页截图。

| 页面 | 390×844 | 768×1024 | 1440×900 |
| --- | --- | --- | --- |
| `/works` 列表 | `works-list-390x844-full.png` | `works-list-768x1024-full.png` | `works-list-1440x900-full.png` |
| `/works/blueberry`（领养·价格） | `work-detail-blueberry-390x844-full.png` | `work-detail-blueberry-768x1024-full.png` | `work-detail-blueberry-1440x900-full.png` |
| `/works/naigai`（4 图图集） | — | — | `work-detail-naigai-1440x900-full.png` |
| `/works` 空筛选态 | — | — | `works-list-empty-1440x900.png` |
| `/admin/login` | `admin-login-390x844.png` | `admin-login-768x1024.png` | `admin-login-1440x900.png` |
| `/admin/login` 错误样张 | `admin-login-error-390x844.png` | — | — |
| `/admin/works` 列表 | `admin-works-390x844-full.png` | `admin-works-768x1024-full.png` | `admin-works-1440x900-full.png` |
| `/admin/works` 空态样张 | — | — | `admin-works-empty-1440x900.png` |
| 编辑器·蓝莓（可发布） | `admin-editor-blueberry-390x844-full.png` | `admin-editor-blueberry-768x1024-full.png` | `admin-editor-blueberry-1440x900-full.png` |
| 编辑器·栗子（阻塞） | — | — | `admin-editor-lizi-blocked-1440x900-full.png` |

首页：`notes/t01-t09/t04-t05/screenshots/`。**2026-07-30 起横向轨道为最终方案**（`home-track-*-hero/full.png` 为当前首页）；编辑型网格组件、实验开关和落选截图已删除，落选证据仍可从 Git 历史恢复。首屏 slogan 已更新为「不只做小狗毛」。

本地复看：`pnpm dev --host 0.0.0.0 --port 3000`（公开 `http://localhost:3000`，后台 `http://127.0.0.1:3000`）。视觉门禁已通过，纯截图采集脚本不再属于标准 E2E。

## 2. 自动化自查结果（`tests/e2e/t08-selfcheck.spec.ts`，23 项全绿）

| 检查 | 方法 | 结果 |
| --- | --- | --- |
| 横向溢出 | 5 页面（首页/列表/详情/后台列表/后台编辑）× 3 视口，`scrollWidth - clientWidth ≤ 1` | ✅ 15/15 |
| 对比度 AA ≥4.5 | 公开标题/次要文字/结果数/页脚；管理标题/说明/四种徽章档位（实测计算） | ✅ 达标（本轮修复 2 处后） |
| 减少动态效果 | CDP 强制 `prefers-reduced-motion`：管理端控件过渡 ≤0.02s；卡片悬停不放大 | ✅ |
| CLS | `/works`、`/works/naigai` 加载期 layout-shift 累计 | ✅ < 0.1（图片均预留宽高） |
| 键盘 | skip link 首焦点；登录 Tab 序（用户名→密码→按钮）；图集缩略图 Tab + Enter | ✅ |
| SSR/CSR 边界 | 详情 HTML 含价格与 og:title；后台初始 HTML 不含夹具内容；公开 Host 访问后台为 JSON 404 | ✅ |
| 真实动作 | 保存/发布/上传/重试/删除均为"接口未接入（T13–T18）"诚实提示；发布未达标时禁用并给原因 | ✅（`admin.spec.ts`） |

本轮在自查中发现并已修复的问题（不列入 must-fix）：

1. 公开筛选结果数（"共 N 件作品"）对比度 3.14:1 → 颜色由 tertiary 提为 secondary。
2. 管理端 success/warning 徽章在 soft 底上 4.44/4.49:1 → Token 加深为 `#2a6e52`/`#8a5a1e`（≥5:1）。

## 3. must-fix 候选的最终判定

| # | 候选 | 说明 | 最终判定 |
| --- | --- | --- | --- |
| C1 | 公开导航五入口 404 | `/commission`、`/adoptions`、`/returns`、`/about`、`/contact` 指向 T26/T27 未建页面，点击 404；T05 遗留的预期边界 | 用户接受现状；对应页面仍按 T26/T27 实现 |
| C2 | 桌面详情竖图超一屏 | PC 端主图已限高（`clamp(20rem, 100vh - 15rem, 46rem)`），纵向图片一屏内完整可见、不裁切、水平居中 | 已修复并通过回归 |
| C3 | 编辑器"公开预览"为卡片级 | 预览用 3:4 卡片图，非详情原比例大图 | 用户接受现状；预览定位保持列表卡片 |
| C4 | 蓝莓卡片 390 视口脸部贴顶 | 焦点已设 50% 24%，仍略贴 | 用户接受现状；T51 正式素材替换时逐图复核焦点 |
| C5 | 登录页无"返回公开站"链接 | 双 Host 在开发/生产域名不同，链接目标不恒定 | 用户接受现状；T13 认证接入时再定 |

最终 `must-fix = 0`。

## 4. 最终确认事项

1. **首页精选方向**：横向轨道为最终方案；网格组件与 `?featured=grid` 开关已删除。
2. **T06/T07 视觉基线**：用户确认通过。
3. **must-fix 判定**：C1、C3–C5 接受现状，C2 已修复，最终为 0。

## 5. 已知限制（不影响本次评审）

- 数据为类型化夹具（6 件作品）；蓝莓/奶盖使用 `materials/picture-examples` 内部开发样张，非出厂照；其余 4 件为 SVG 占位。
- 后台所有写动作未接入（T13–T18）；登录不校验凭据、不产生会话。
- 详情页"继续浏览"为静态排除当前作品的目录顺序，非智能推荐。

## 6. 2026-07-30 用户反馈与处理（第一轮）

| # | 反馈 | 处理 |
| --- | --- | --- |
| F1 | 首页按横向轨道组织 | ✅ `FeaturedWorks.vue` 使用横向轨道；T08 最终验收后已删除网格组件与实验开关。IA/DESIGN_BRIEF 已固化该决定 |
| F2 | PC 端详情主图过大，纵向图片一屏看不全、需上下滑动 | ✅ `WorkDetailGallery.vue` ≥1024px 主图限高 `clamp(20rem, calc(100vh - 15rem), 46rem)`，宽度按原比例自适应、水平居中、不裁切；移动/平板不变。实证 `work-detail-naigai-1440x900-viewport.png`（实测主图 440×660），回归断言已并入 `public-works.spec.ts` |
| F3 | slogan 由「为每一个角色，做一件认真的兽装。」改为「不只做小狗毛」 | ✅ `heroFixture.tagline` 已更新；已固化进 IA 命名约定表（2026-07-30 景宸确认） |

截图已重新采集：首页当前保留 `notes/t01-t09/t04-t05/screenshots/home-track-*`，详情保留 `work-detail-*-1440x900-full.png`；落选网格只留在 Git 历史。

## 7. 2026-07-30 最终验收与门禁结论

用户读完本评审记录并完成页面验收后，确认：

- T06/T07 视觉基线接受；
- 第 3 节 C1、C3、C4、C5 暂留并接受现状；
- C2 的 PC 端详情主图限高修复接受；
- 首页采用横向精选轨道；
- `must-fix = 0`，T08 通过。

收口动作：

- TASKS 中 T08 已勾选；
- 编辑型网格组件和 `?featured=grid` 开关已删除，历史网格截图保留作决策证据；
- STATE、PLAN、设计契约、执行路由与产物索引已同步；
- 收口后 `pnpm lint`、`pnpm typecheck`、51 项单测、3 项集成测试、84 项 E2E、`pnpm build` 与 `pnpm verify:production` 全部通过；
- 当前下一项为 T09，不在本轮提前实现。
