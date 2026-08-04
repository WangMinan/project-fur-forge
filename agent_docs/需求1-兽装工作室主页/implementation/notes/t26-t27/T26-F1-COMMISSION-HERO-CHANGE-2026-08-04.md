# T26-F1 · 委托页独立大图变更

> 日期：2026-08-04
> 状态：工程实现与实现方自测完成；独立 Review/用户验收待执行
> USER_GATE：未代签；T26 的既有验收历史保持有效

## 1. 用户目标

- `/commission` 的背景大图不再复用首页第一项；
- `/admin/site/home` 增加“首页大图 / 委托页大图”Tab；
- 委托页大图复用首页现有横竖双图上传、alt、启停、排序、私有水印预览和公开发布链路；
- 无委托页大图时隐藏引导区，不回退首页，也不生成占位图。

## 2. 锁定行为

1. `site_hero_slides` 增加 `placement = home | commission`；既有记录回填为 `home`。
2. 首页与委托页各自最多启用 5 项，启用顺位在各自集合内唯一。
3. 首页继续要求至少保留 1 项；委托页允许全部停用。
4. 公开委托页不变成轮播，只投影委托集合中启用且排序第一项。管理员通过上移/下移切换当前背景，同时可保留已发布备选图。
5. 两个集合继续使用 `home_hero_landscape` / `home_hero_portrait`、`recipe-v2` 和活动 `brand-centered-v2`；不新增媒体角色、Bucket、上传表或第二套图片处理逻辑。
6. 管理和公开浏览器只接收 `assetId` 或公开 variant URL，不接收私有 Object Key、Bucket、签名 URL或作品私有联系人。

## 3. API 与数据差异

- 既有首页管理接口增加严格的 `placement` 查询参数，省略时保持 `home`，兼容现有调用；非法值返回 400。
- 新增公开只读 `GET /api/public/v1/commission-hero`，`no-store`，只返回 `slide | null`，不返回后台版本或未选中的备选项。
- `site_content.version` 继续作为站点大图集合的乐观锁；不新增第二个版本计数器。
- `site_hero_slides` 的唯一索引由启用 `sort_order` 改为启用 `(placement, sort_order)`。

## 4. Vue 组件边界

- `app/pages/admin/site/home.vue`：路由级编排、Tab、首页设置和当前集合切换；不复制两份页面。
- `app/components/admin/HomeSlideCard.vue`：继续负责单个大图项的字段、动作、进度和预览；新增位置输入，只改变可见名称与请求上下文。
- `app/components/admin/HomeHeroSlotField.vue`：继续负责单个横/竖上传槽位；新增位置输入用于可访问名称，上传实现保持同一 composable。
- `app/composables/useAdminHome.ts`：继续作为唯一大图管理状态源，按当前位置生成请求并在 Tab 切换时重载。
- `app/pages/commission.vue`：改读独立公开投影；`CommissionLead` 继续只接收一张双源图。

## 5. 最小充分验证

- 迁移：旧首页记录全部为 `home`；两个位置可同时启用相同顺位；非法位置被数据库拒绝。
- 服务端：两套管理集合相互隔离；首页最后一项仍不可停用；委托页最后一项可停用；公开接口只返回委托排序第一项或 `null`。
- 前端：Tab 键盘可达、切换后数据不串页；委托 Tab 可上传横竖图、创建、启用、上移/下移、停用和重载恢复。
- 公开端：`127.0.0.1` 的 `/commission` 请求独立资源，桌面取横版、手机取竖版；0 项时没有背景图且不请求首页 Hero。
- 基础门禁：`pnpm db:migrate`、lint、typecheck、定向 unit/integration/E2E、build。

## 6. 实施与实现方验证

- 数据：新增 `0013_t26_f1_commission_hero.sql`，以 `placement` 隔离两套集合；开发库迁移成功，自动创建迁移前备份。
- 服务端：既有首页管理路由严格读取 `placement`，默认 `home`；新增安全公开投影 `/api/public/v1/commission-hero`，只返回第一项或 `null`。
- 管理端：`/admin/site/home` 增加“首页大图 / 委托页大图”可访问导航 Tab；两边共用同一页面、卡片、上传 composable、排序和发布服务。
- 公开端：`/commission` 只读取委托集合，无图时隐藏背景区，不再读取或回退首页 Hero。
- 自动化：`pnpm test` 通过 16 文件/101 项；`pnpm test:integration` 通过 12 文件/95 项；新增投影/换序定向用例通过 6 项；lint、typecheck、build、`verify:production` 均通过。
- 浏览器：委托 Tab 的真实横竖上传、创建、启用、公开显示、全部停用和首页隔离用例通过；相关首页/委托回归共 33 项均已取得通过结果（首轮 31 项，修正文案兼容后定向复跑 2 项）。
- 门禁：以上均为实现方证据，不代签新上下文独立 Review；`TASKS.md` 中 T26-F1 保持未勾选。

## 7. 明确不做

- 不把委托页改成轮播；
- 不建设通用页面媒体 CMS；
- 不复制上传/水印配方；
- 不录入 OQ-120 候选文案；
- 实现方自测不代替新上下文独立 Review 或用户验收。
