# T37 实施记录：轻量展会掉落

> **日期**：2026-08-08。
> **本任务 commits**：`c489aae T37: add lightweight event drops`、
> `fd6ef84 T37: fix stale adoption method hint`。
> **性质**：dated note。当前权威见 `requirements/SPEC.md` 与 `models/README.md`。

## 1. 如何复用现有模型

底层保持三种 purpose，掉落只是领养的一种方式：

```text
purpose = adoption
adoption_method = event_drop
```

管理端向景宸显示四个易懂选项，只做映射，**没有新增第四种底层 purpose**：

```text
委托作品     -> commission
常规领养     -> adoption + regular
展会掉落     -> adoption + event_drop
纯展示       -> showcase
```

映射函数 `businessTypeOf` / `purposeOfBusinessType` 在 `app/utils/work-form.ts`。

复用而未新建的部分：领养状态与价格、设定图与出厂照、活动 `brand-centered-v2`
作品水印、作品 publication operation 与下架清理、统一作品详情、
`/works` 投影、作品 URL 与 SEO。**没有新增 events 表、event_works、
展会 slug、展会媒体角色、展会配方、展会 operation 或展会管理页。**

集成测试断言掉落媒体仍是 `recipe-v2` + `protection_mode=watermark`，
且 `usage LIKE '%event%'` 的变体数量为 0。

## 2. 数据库（前向迁移 0023）

- 历史 `current_event_name` 规范为 `event_name`，新增展会时间展示文本 `event_time`；
- 迁移只为 `event_drop` 保留历史展会名称，其他作品一律置空，
  避免带着与新 CHECK 冲突的僵尸值迁移；
- `works_event_drop_fields` CHECK：
  - 非掉落作品两项必须为空 → 切换离开掉落不可能留下僵尸值；
  - 掉落**草稿**容忍缺项（编辑过程中的正常中间状态）；
  - **已发布**掉落两项必须去空白后非空。
  - 与 alt、设定图同一套心智：草稿可以不完整，发布检查负责拦截。
- 重建 `works` 时统一先删后建全部引用 `works` 的触发器（9 个），
  并把 `work_assets_role_immutable` 一起重建以保持既有报错顺序。

已发布的 event_drop 在迁移前不可能存在（T18 起 `EVENT_DROP_NOT_READY`
一直硬阻断掉落发布），因此迁移不需要为它编造占位文案。

迁移在真实 dev.db 副本上验证：`integrity_check = ok`、`foreign_key_check` 0 行、
works 3 行与 return_photos 1 行保持、触发器 34 个，并手工确认四条不变量：
非掉落带展会字段被拒、掉落草稿可只填一项、无时间发布被拒、
未清空展会字段就切换类型被拒。

## 3. 发布检查

原先 `EVENT_DROP_NOT_READY` 整体阻断掉落发布，现改为
`EVENT_DROP_FIELDS_REQUIRED`，只在缺展会名称或展会时间时出现，
并且掉落与常规领养共用同一条设定图要求。非掉落作品残留展会字段
会落入 `WORK_FIELDS_INVALID`。

## 4. 契约

- `workFieldsSchema` 的 adoption 分支带 `eventName` / `eventTime`（可空），
  并用 `superRefine` 保证非掉落时两项必须为 null；commission / showcase 分支
  在类型层面就 `z.never()`，因此不可能携带展会字段；
- 公开 `publicAdoptionWorkDtoSchema` 增加 `eventName` / `eventTime`，
  只有掉落有值；
- `publicAdoptionListDtoSchema` 不再限定 `adoptionMethod: 'regular'`，
  并增加 `filter`（含 `valid`）与 `counts`（all/regular/event_drop）。

## 5. 公开端

`/adoptions` 三个筛选是**普通链接**（`/adoptions`、`?method=regular`、
`?method=event_drop`），SSR 与无 JavaScript 时可用，选中态同时用文字权重、
边框与底色表达。非法参数收敛为“全部”并标记 `valid=false`，不抛 500。
空态按筛选区分“没有领养 / 没有常规领养 / 没有掉落 / 筛选无效”。

掉落卡片、首页当前领养与统一作品详情显示一致的
「展会掉落」标签 + 展会名称 + 展会时间；常规领养不出现空展会字段。
长文本受控折行，不遮挡图片、状态或价格。

`event_time` 只是展示文本：不解析为可调度日期，不进入结构化数据，
不触发倒计时或自动状态切换（字段帮助文本明确写出这一点）。

## 6. 管理端

作品编辑器业务类型改为四选项；选择展会掉落后显示展会名称与展会时间两项短文本。
切换离开掉落或离开领养时给出明确提示，说明哪些字段会在保存时被清空。

移除已过时的「历史展会记录（只读）」区块与「转为常规领养」转换流程
——掉落现在是正式可编辑类型，不再需要先转换才能保存。
保留旧 `event_sale` 状态的提示（该状态仍不可写入）。

同时修掉一处过时文案：领养信息里原本写着
「当前仅支持常规领养；展会掉落将在后续提供专门管理」。

## 7. 测试

- 新增 `tests/integration/event-drop-projection.test.ts`（3 项）：
  三筛选与真实计数、非法参数收敛、详情展会字段、
  掉落媒体仍为 recipe-v2 水印且无 event 专用配方、首页当前领养含掉落；
- `tests/unit/work-form.test.ts` 增加四选项映射、只有掉落才提交展会字段、
  切换类型提交 null、读回表单、旧 event_sale 识别；
- `work-management` 的展会用例重写为「补齐两项 → 切换后清空」；
- `work-publication` 的用例重写为「缺时间被 `EVENT_DROP_FIELDS_REQUIRED` 阻断，
  补齐后不再阻断」。

## 8. 真实浏览器证据（1440×900）

- 管理端：业务类型显示四项；切到展会掉落后出现展会名称/时间，
  帮助文本包含“不会自动改变领养状态”；填入「幻夏祭 2026」与
  「8 月 15 日 至 16 日」后保存，服务端返回 `adoption_method=event_drop`
  与两项字段；发布检查 `canPublish=true`、blockers 为空；发布后 operation DONE；
- 切回常规领养时出现提示「展会名称与展会时间会在保存时被清空，不会留下残留值」，
  展会输入随即消失；
- 公开端 `/adoptions`：三筛选计数为 全部 2 / 常规领养 1 / 展会掉落 1；
  掉落卡片显示标签 + 名称 + 时间，常规领养卡片无空展会字段，无横向溢出；
- `?method=event_drop` 只剩 tasty-dragon；`?method=regular` 只剩 cloud；
  `?method=bogus` 收敛为全部且 `valid=false`；
- `/works/tasty-dragon` 事实侧栏依次为
  物种 / 装型 / 角色主人 / 用途 / 领养方式（展会掉落）/ 业务状态 /
  展会名称 / 展会时间。

## 9. 未验证边界

- 390×844 真机手机闭环（展会两项字段、状态、价格、发布与下架）尚未逐项点击；
- 新上下文独立 Review 与用户人工验收未进行。
