# Build Tasks: 首页 2-4 幕图文协调重排

Generated from: `.design/home-scene-typography/DESIGN_BRIEF.md`
Branch: `codex/r4-e-home-scene-typography`
Round 3 date: 2026-08-24（景宸看过第二轮后的反馈）

## 前两轮已完成（不再重复）

- [x] SPEC 5.3 第 113/115/208 条改为「文字块组件」口径；COPY.md 新增 §5 首页章节文案。
- [x] `HomeSceneIntro.vue` 三幕共用文字卡（eyebrow / 标题 / hairline / 状态槽 / 导语 / meta 槽 / 行动槽）。
- [x] `.home-scene` / `.home-scene__stage` + `--media-start` / `--media-end` 共用骨架，栏比与 gap 单点定义。
- [x] 媒体高度 56svh；上下 `--space-8`；桌面恢复 `min-height` + `align-content: center`。
- [x] 迁移 `0048`：三条 `home_*_lead` + `home_copy_version`；管理端「首页章节文案」卡片；`homeAggregate` 读取路径。
- [x] 首页移除防御性表述，`note` 层与 `shared/constants/home-scene.ts` 一并删除。
- [x] 领养幕移除价格；名称·物种与领养状态合并同一行。

---

## Round 3

### Phase 0 · 契约签字（阻塞实现）

本轮有**两处与已锁定 SPEC 直接冲突**，必须先改 SPEC 再动代码：

- [ ] **SPEC 117 图文左右节奏反转**。现文：「桌面保持**图片左、右、左**的阅读节奏」。当前实现正是图左/右/左（即文字右/左/右）。你要求文字卡改成**左-右-左**，因此图片变成**右-左-右**，与 117 直接矛盾。改为：「桌面保持文字卡左、右、左的阅读节奏，主媒体相应为右、左、右」。
- [ ] **SPEC 120 领养营业状态退役**。现文：「委托与领养营业状态在各自首页章节中使用同一圆点、状态标签和开放程度组件」。改为只保留委托营业状态，并说明领养不再维护营业状态。同时复核 SPEC 中所有「领养营业状态」「开放程度」表述（含 §5.3、验收清单）。
- [ ] **COPY.md 同步**：新增/改写营业状态默认文案段（见下方 T4），并更新 §5 第四幕导语（见 T5）。

### Phase 1 · 布局与视觉

- [ ] **T1 图文左右反转为文字-左/右/左**。`FeaturedWorks` 由 `--media-start` 改 `--media-end`；`HomeBusinessEntries` 由 `--media-end` 改 `--media-start`；`HomeCurrentAdoptions` 由 `--media-start` 改 `--media-end`。**只换修饰类，不新增每幕栏比**——骨架已支持两向。改完需确认三幕左右边界仍等宽、DOM 顺序仍是文字卡在前（Tab 焦点不跳）。_Depends on: SPEC 117 签字。_

- [ ] **T2 第三/四幕图片缩小 + 外侧 L 形引导线**。新增媒体包裹层（如 `.home-scene__media-framed`）：**包裹层与文字卡等高**（`height: 100%`），内部图片按比例缩小（约 82%，居中），缩出来的空隙容纳引导线。引导线用 **CSS 伪元素**画左上与右下两条 L 形括弧（`::before` / `::after` + `border-top`/`border-left` 与 `border-bottom`/`border-right`），颜色取 `--public-border-primary`，粗细 1px。第二幕双图不加（两图已自带节奏，加了会碎）。`aria-hidden` 不需要——伪元素不进无障碍树。_新增共用 CSS，两幕复用；不为两幕各写一份。_

- [ ] **T3 自设委托卡片标题居中**。仅第三幕：`HomeSceneIntro` 新增一个 `align="center"` 之类的 prop 或让第三幕传一个修饰类，把 eyebrow + 标题 + hairline 居中（hairline 居中后应收窄或保持满宽，实现时对比取更稳的一个）。**另两幕不动**。注意居中只作用于标题簇，导语与行动仍左对齐，否则整卡会散。

- [ ] **T6 首页卡片 hover 投影**。复用 `/works` 的 `WorkCard` 现有观感：`translateY(-0.25rem)` + `box-shadow: 0 1rem 2.25rem rgb(17 20 25 / 0.14)` + 图片 `scale(var(--image-hover-scale))`，全部包在 `@media (hover: hover) and (pointer: fine)` 内，并保留 `prefers-reduced-motion: reduce` 降级。首页三幕当前 hover 只有 `scale(1.025) rotate(...)`，需统一到这一套。**投影值抽成共用令牌**（如 `--shadow-card-hover`），避免 `WorkCard` 与首页各写一份魔法数。

### Phase 2 · 领养营业状态彻底退役（代码 + 数据库）

> 已获你本轮明确授权：代码与数据库一起清，`limited` 从 Schema 删除，默认状态改开放。

- [ ] **T4a 迁移 `0049_r4_e_retire_adoption_status.sql`**。SQLite 无法修改 CHECK，需重建 `business_statuses`：新表 CHECK 为 `kind IN ('commission')`、`tone IN ('open','closed')`、`href = '/commission'`；拷贝时 `DELETE` 掉 `kind='adoption'` 行，并把 `limited` 归一为 `open`（当前真实数据就是 limited）；同时写入新的状态默认文案。参考 `0037` 的重建模式（`PRAGMA foreign_keys=OFF` + `legacy_alter_table=ON`）。_只新增前向迁移。_

- [ ] **T4b Drizzle schema 同步**：`businessStatuses` 三条 CHECK 与迁移逐字一致。

- [ ] **T4c 契约收敛**：`shared/schemas/site-content.ts` —— `siteBusinessStatusKindSchema` 去掉 `'adoption'`、`siteBusinessStatusToneSchema` 去掉 `'limited'`、`href` enum 去掉 `'/adoptions'`；`statusPairSchema`（line 165）从 `{commission, adoption}` 收敛为只有 `commission`（或直接改为单值，实现时取改动更小的一个）。`shared/schemas/public-content.ts` 的 `currentAdoptions.status`（line 153）移除。

- [ ] **T4d 服务与投影**：`server/utils/service/site-content.ts` 的 `businessStatuses()` / `getPublicBusinessStatuses()` 只返回 commission；`public-site-repository.ts` 的 `homeAggregate` 去掉 `statuses.adoption` 与 `currentAdoptions.status`；注意 `entryCard` 里 `summary: status?.detail` 对 adoption 的引用要一起处理。

- [ ] **T4e 前端清理**：`app/pages/admin/site/content.vue` 去掉领养状态卡片（并调整 `content-admin__statuses` 的双栏 grid，只剩一张卡时不要留空栏）；`app/pages/adoptions/index.vue:43` 去掉 `statuses.adoption` 与整个状态展示块；`HomeCurrentAdoptions` 去掉 `status` prop 与状态槽；`HomeBusinessStatus.vue` / `PublicBusinessStatus.vue` 去掉 `limited` 分支；`app/utils/site-content.ts` 去掉 `SITE_STATUS_KIND_LABELS.adoption`、`SITE_STATUS_TONE_LABELS.limited`、`SITE_STATUS_TONE_VALUES` 里的 `limited`；`app/composables/useAdminSiteContent.ts:23` tone 联合类型去掉 `limited`。

- [ ] **T4f 状态文案重写**。现有默认（`0014`）是「委托咨询开放 / 可通过邮件发送设定图与需求，是否接单及排期以工作室回复为准。」——AI 味重且提到邮件（现在主渠道是站内表单 + 官方 QQ）。改成口语化、说清「现在能不能找我们」，并与首页不放防御性表述的原则一致。写入 COPY.md 作为权威。

### Phase 3 · 文案

- [ ] **T5 第四幕导语改为你给的版本**：`这里有一些已经完成部分制作、等待领养的设定，也许其中就有你想成为的那个角色。`（**37 字，未超 120 上限**）。同时更新迁移 `0048` 的默认值？——**不改 `0048`**：它已应用且 hash 已记录，改它会再次触发迁移守卫拒绝。改动写进 `0049` 的 `UPDATE`，并同步 COPY.md §5 与 brief。

### Phase 4 · 验证

- [ ] **T7 测试修复与补充**。`tests/integration/auth-api.test.ts` 有多处断言领养状态与 `limited`（约 line 578 `statuses: {commission: null, adoption: null}`、794 `'limited'`、797/804 adoption 200、819/846 adoption 投影），全部需按新契约改写；补一条「adoption kind 被拒绝」与「limited tone 被拒绝」的负向断言。
- [ ] **T8 全量验证**：`pnpm check:fast` → `pnpm test:smoke`。注意 `work-publication.test.ts` 的 Lanczos 用例在全量套件下会因 CPU 争用偶发 30s 超时（本轮已确认单独跑 20/20 通过），失败时先单独重跑再判断。
- [ ] **T9 真机/浏览器视觉确认**：390×844、430×932、768×1024、1023×900、1024×900、1440×900。重点：三幕左右边界等宽、引导线包裹层与文字卡等高、第三幕标题居中不显散、hover 投影一致、无横向溢出。**这一步我做不了代签，需要你或景宸看。**
- [ ] **T10 文档收口**：更新 `implementation/TASKS.md` 与 `STATE.md`；`.design/README.md` 记录左右节奏反转、引导线与领养状态退役。

## 风险与顺序建议

1. **Phase 2 风险最高**（重建表 + 契约收敛 + 6 处前端清理），建议**单独一个 commit**，与 Phase 1 的纯视觉改动分开，方便回滚。
2. Phase 1 的 T1/T3/T6 互不依赖，可一起做；T2 最容易反复调，建议放在 T1 之后单独收。
3. 本地 `.data/dev.db` 已是 49 条迁移的干净状态；`0049` 落地后需再跑一次 `pnpm db:migrate`。**跑之前先确认没有 dev server 占用该库**（Windows 下被占用会写失败），这正是上一轮迁移报错的成因。
