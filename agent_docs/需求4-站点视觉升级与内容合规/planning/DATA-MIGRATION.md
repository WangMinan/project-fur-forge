# 数据迁移与运维计划：需求4

> **角色**：固定需求4的前向文案迁移、无 Schema 变更项、生产停止点与人工删除流程。
> **状态**：2026-08-19 第二轮 Review 与空上下文文档复核后定稿待实现。
> **原则**：本轮不为轻量确认新增数据库结构；不重写需求1～3已经执行的迁移。

## 1. 当前基线

- 第二轮应用代码审查基线：`main@aa8e5b70be0913f02ceddccdc262ec6fe0769df1`；对应文档合入基线：`main@ea3ae0a1269676db8c06c28ed32a9a29f4bd7109`（无应用代码变更）。
- `site_content` 已有 about、commission、terms、privacy、contact 分区版本。
- `commission_submissions` 已有 pending/accepted/rejected、手机号、QQ、身高、体重、私有设定图关系和资源版本。
- `assets` 已有归一化 `focal_x/focal_y`；需求4不新增焦点表。
- `works` 已有 `updated_at`，足以实现领养组内排序。
- 现有上传清理覆盖失效/失败的未消费上传；正式申请删除仍需新增单条受控工具。

## 2. 本轮明确不做的 Schema 迁移

需求4第二轮 Review 取消以下原计划：

- `site_content.privacy_controller_name`；
- `commission_submissions.intake_contract_version`；
- `adult_confirmed`、`privacy_policy_version`、`application_notice_version`、`notice_confirmed_at`；
- intake metadata 表/API；
- legacy/v2 contract 表重建；
- `retention_until` 或 scheduler 表；
- Hero pair/focal/crop 表；
- adoption 排序专用字段。

理由：现有字段和流程足以表达真实需求；新增模型会把简单提交确认和人工运维扩大成不必要的平台能力。

## 3. 发布单元 A：测试与组件地基

本单元没有数据库迁移。先完成：

1. 公共行动、管理行动和统一进度组件；
2. 上传/长 operation 进度接入；
3. 测试分类、脚本和 workflow 减重；
4. `/adoptions` 排序与首页单项领养。

该顺序允许后续隐私、首页和 Hero 工作直接复用统一组件，避免先继续复制按钮和 progress。

## 4. 发布单元 B：默认文案前向迁移

### 4.1 可自动替换

以下字段只在 NULL、空白或与仓库已知历史默认全文精确一致时替换：

- `commission_intro`
- `commission_estimate_note`
- `commission_email_action`
- `about_studio_facts`
- `about_making_scope`
- `basic_terms`
- `contact_anti_scam`

目标全文来自 `../requirements/COPY.md`。

### 4.2 实际经营主体

- 仓库不提交真实经营主体证照信息，也不新增结构化字段。
- `privacy_policy` 不在不知道真实经营主体时自动写入带占位符的数据库默认值。
- 发布前由工作室依据 `COPY.md` 通过现有管理端写入完整隐私政策，把 `{{controller_name}}` 替换为实际经营主体名称，并核对 `contact_email`。
- 只有最终成文保存完成后才递增隐私分区版本；readiness/发布 smoke 验证公开文本不存在 `{{...}}` 占位和旧“网站不收集联系方式/设定图”表述，不读取或记录证照详情。

### 4.3 不可自动替换

管理员已经修改的其它真实内容：

- 不自动覆盖；
- 只输出字段名和“需人工 Review”，不输出全文到普通日志；
- 工作室通过现有管理端确认和保存；
- 隐私政策/服务条款未完成人工 Review 时不签发布门禁。

### 4.4 版本

- 隐私政策变化：`privacy_content_version + 1`；
- 服务条款变化：`terms_content_version + 1`；
- about/commission/contact 各自只递增自己的 section version；
- `site_content.version` 同步递增；
- 申请页两个 checkbox 文案由代码/COPY 管理，本轮不建立独立持久版本。

## 5. 轻量申请确认上线顺序

```text
1. 完成目标隐私政策/服务条款默认迁移
2. 工作室人工写入真实经营主体名称并核对邮箱/QQ
3. 申请页增加两个未预勾选确认
4. 请求 Schema 增加两个 literal true
5. service 在消费 upload 前校验
6. 负向验证缺失/false 不创建申请且不消费 upload
7. 真实浏览器完成人工提交验收
```

停止点：

- 隐私政策仍声称网站不收集联系方式/设定图；
- 页面出现 `{{controller_name}}` 等占位；
- 两项确认被预勾选；
- 缺失/false 仍可提交；
- 校验失败后 upload 被消费或表单/图片丢失；
- PII 进入公开 DTO、HTML、analytics、普通日志或错误。

本单元没有 expand/contract，也不需要旧镜像/新字段兼容演练。

## 6. 领养排序与首页单项

无数据库迁移。

实现顺序：

1. repository 查询携带 `works.updated_at`；
2. 建立 `available → adopted`、组内 `updated_at DESC → id ASC` 的唯一 comparator；
3. `/adoptions` 搜索前排序、过滤后保持顺序、最后分页；
4. 首页聚合从同一有序集合取第一项 available；
5. `HomeCurrentAdoptions` 删除 `.slice(0, 2)` 和双列假设；
6. 验证修改为 adopted 的作品不会跑到 available 前面。

不改变 `/works` 的现有发布时间排序，不重写作品 `sort_order`。

## 7. Hero 焦点与管理端

无数据库迁移：

- 复用 `assets.focal_x/focal_y`；
- 已有任意坐标原样保留；
- UI 九宫格写入 0 / 0.5 / 1；
- recipe identity 已含焦点，修改后必须通过既有 publication operation 生成新变体；
- 不直接 UPDATE 已启用 Hero 对应资产后让公开 URL 与数据库身份失配；
- 四集合继续独立，管理端重组不改变 collection version 或 owner context。

如果同一 asset 被多个 item 复用且焦点需求冲突，本轮阻断并要求上传独立资产，不静默覆盖。

## 8. 人工保留复核

### 8.1 调度

不建设 scheduler。工作室按 SOP 人工执行：

- 失效/失败/取消且未消费上传：至少每月；
- 委托申请总览：至少每半年；
- 用户删除请求：收到后单独执行；
- accepted：业务、保修、争议和法定必要期限结束后逐条确认。

SOP 只维护流程、停止点与建议频率；不建调度/提醒，不在仓库文档填写虚构的生产执行日期、操作员或删除结果。真实执行证据若后续由操作员保留，仍不记录 PII、完整 Key 或可恢复 manifest。

### 8.2 Review 候选

只读候选可以按：

```text
rejected
pending AND created_at < review_cutoff   # 只提示复核
```

- rejected 在拒绝后立即成为单条删除候选；
- pending 不标记为自动可删；
- accepted 只通过显式 ID 人工查看；
- legal hold/争议由操作员排除。

## 9. 单条精确删除

### 9.1 Dry-run

1. 接收一个 submission ID 或回执；
2. 查询 submission/session/asset 关系；
3. 检查 asset 是否被作品、Hero、水印或其它 owner 异常引用；
4. 枚举 PRIVATE current objects、variants、preview、pending、versions/delete marker；
5. 输出脱敏计数和目标状态；
6. 不写数据库、不删对象。

### 9.2 Execute

正式执行必须使用 `--execute` 与固定强确认短语：

```text
DELETE COMMISSION APPLICATION DATA
```

每次只允许一条申请：

1. 在数据库关系仍存在时固定精确 ID/Key 到内存；
2. 阻断目标申请的并发写；
3. 删除 OSS current objects；
4. 删除 versions/delete markers（若启用）；
5. 验证对象不可达；
6. 事务删除/去标识 submission、session、asset variants、asset 和非必要备注；
7. 写最小化删除审计；
8. 再次查询确保零残留。

不得提供 `--status rejected --before ... --execute` 之类时间批量执行。人工批次通过逐条重复命令完成。

### 9.3 重入和失败

- 对象已不存在：幂等完成；
- DB 行已不存在：返回“已完成/不存在”；
- OSS 非 NotFound 错误：停止，保留 DB 关系；
- 外部引用异常：停止，不级联猜测；
- DB commit 失败：允许按同一 ID 重入；
- 多条申请必须串行。

### 9.4 备份

- 删除数据可能在受限备份中保留至正常轮换；
- 备份不作日常查询或恢复已删除申请；
- 灾难恢复后，在服务重新开放前重跑删除/保留复核；
- 不创建包含 PII 的长期删除批次导出。

## 10. 测试体系迁移

### 10.1 先降级，再精选

现有测试不要求一次性全部删除：

1. 给现有 unit/integration/E2E 标注 `core / smoke / legacy`；
2. 默认脚本只执行 core；
3. 建立少量 smoke；
4. legacy 从默认 workflow 移除；
5. 逐项 Review：证明稳定不变量则提升，否则删除；
6. 不为全绿机械修改旧文案、DOM 或动画毫秒断言。

### 10.2 目标命令

实现时建立或等价提供：

```text
pnpm check:fast    # lint + typecheck + core
pnpm test:core     # 稳定不变量
pnpm test:smoke    # 少量 Playwright 主流程
pnpm test:release  # build/verify + 必要部署 smoke，由人显式启动
pnpm test:legacy   # 迁移期可选，不作门禁，最终可删除
```

### 10.3 Workflow

默认 `quality`：

- 文档-only 变化不运行应用重型任务；
- 代码变化运行 lint、typecheck、core，必要时 production build；
- 不默认执行 image-build/restore/Nginx/full E2E。

release/manual：

- production build + verify；
- 精简 smoke；
- 镜像/Compose/恢复/Nginx；
- destructive drill 仅在相关发布时；
- 人工浏览器/手机验收单独记录。

不新增 required check；workflow 失败也不替代用户对视觉和业务的最终判断。

## 11. 第三方声明

无数据库迁移。

实现增加确定性生成输入/产物：

```text
config/third-party-registry.(json|ts)
app/assets/licenses/third-party-notices.json
app/assets/licenses/THIRD_PARTY_NOTICES.txt
```

- JSON/TXT 由同一输入生成；
- 不写生成时间；
- 排序稳定；
- npm 事实来自生产依赖；
- `ffmpeg-static` 包与镜像内实际 FFmpeg 二进制分开记录；本轮只完成 npm/asset 事实。Linux 发布镜像中的二进制 registry、容器嵌入与分发核验后置到部署阶段；
- Noto Serif SC、ZhuoHei Collage 由 asset registry 补充；
- release 前核对 Docker Hub 可见性；当前公开仓库按分发场景生成容器内声明和 `/licenses` 数据，禁止输出“未分发”文案；
- 缺失/未知许可证时失败，不猜测；
- `/licenses` 不再维护平行手写运行时数组。

## 12. 发布与回滚

- 组件/排序/测试减负可以先独立发布，不依赖隐私 Schema。
- 文案错误使用新的前向迁移或管理端修正，不改写已执行迁移。
- Hero 焦点通过重新选择旧焦点并重新发布回退，不直接恢复旧对象 Key。
- 单条删除不可逆，只允许在隔离数据、dry-run 和强确认后执行，不以备份恢复作为常规撤销。
- 测试 workflow 减重后保留旧配置的 Git 历史；如快速门禁遗漏稳定不变量，应把该不变量提升到 core，而不是恢复所有历史测试。

## 13. 生产证据

需求4闭环至少保留：

- 文案 migration SHA/镜像 digest；
- 隐私政策无占位、真实收集行为和联系邮箱的人工核对；
- 两项确认缺失/false 拒绝与成功提交结果；
- `/adoptions` 排序和首页单项结果；
- 单条删除 dry-run/execute/重入计数；
- third-party notices 生成与 drift 结果；
- Hero 焦点中心/四角与横竖管理体验；
- 统一上传/FFmpeg/operation 进度截图；
- `check:fast`、`test:smoke`、release smoke；
- 王旻安/景宸人工视觉验收。

证据不得包含申请内容、PII、私有图、完整 Key、token、签名 URL 或聊天记录。
