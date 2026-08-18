# 数据迁移与运维计划：需求4

> **角色**：固定需求4的前向迁移、兼容顺序、生产停止点与人工删除流程。
> **状态**：2026-08-19 已定稿待实现。
> **原则**：不重写需求1～3已经执行的迁移；先 expand、兼容读写和配置，再启用新的申请确认与删除能力。

## 1. 当前基线

- 当前文档基线：`main@913d257281e0b6a7ca60711cc62b78534904c6bd`。
- 当前最近迁移为需求3序列；实现时使用仓库下一个空闲前向编号，不在本文件强占固定编号。
- `site_content` 已有 about、commission、terms、privacy、contact 分区版本。
- `commission_submissions` 已有 pending/accepted/rejected、手机号、QQ、身高、体重、私有设定图关系和资源版本。
- `assets` 已有归一化 `focal_x/focal_y`；需求4不新增焦点表。
- 现有上传会话清理只覆盖失效/失败的匿名上传，不等同于正式申请删除。

## 2. 发布单元 A：Schema expand

### 2.1 `site_content`

前向增加：

```sql
privacy_controller_name TEXT NULL
```

约束：

- NULL 允许迁移和兼容部署；
- 非 NULL 时 trim 后 1–200 字；
- 禁止 `<`、`>`；
- 不写入假经营主体；
- `contact_email` 继续作为隐私联系邮箱；
- 编辑经营主体名称时递增 `privacy_content_version` 和总 `version`，不递增其它分区版本。

迁移后旧镜像必须仍可读取该表；新镜像不得在字段未配置时接受新委托申请。

### 2.2 `commission_submissions`

前向增加：

```sql
intake_contract_version       INTEGER NOT NULL DEFAULT 1
adult_confirmed               INTEGER NULL
privacy_policy_version        INTEGER NULL
application_notice_version    INTEGER NULL
notice_confirmed_at           INTEGER NULL
```

目标 CHECK 见 `../models/README.md`。

迁移语义：

- 所有既有行保留 `intake_contract_version=1` 和 NULL 确认字段；
- 不使用提交时间回填 `notice_confirmed_at`；
- 不推断历史申请人年龄或是否阅读过政策；
- 新代码只创建 v2；
- 列表/详情兼容 v1 和 v2。

新代码稳定写入 v2 后再执行前向 contract：

- 将目标表的 `intake_contract_version` 默认值收口为 2；
- 保留历史 v1 行；
- v2 缺任一确认字段时数据库 CHECK 拒绝；
- contract 前验证部署后新增行中不存在 v1；
- contract 后旧镜像不得重新上线写入。

SQLite 若无法安全地通过 `ALTER TABLE` 表达目标 CHECK/默认值，则使用前向重建表：

1. `PRAGMA foreign_keys=OFF`；
2. 创建目标临时表；
3. 完整复制既有列和 legacy 默认；
4. 重建索引、触发器和外键；
5. 运行 `foreign_key_check`、完整性和重入测试；
6. 恢复 pragma。

不得顺手删除或重分类任何真实申请。

## 3. 发布单元 A：默认文案迁移

### 3.1 可自动替换

以下字段只在 NULL、空白或与仓库已知历史默认全文精确一致时替换：

- `commission_intro`
- `commission_estimate_note`
- `commission_email_action`
- `about_studio_facts`
- `about_making_scope`
- `basic_terms`
- `privacy_policy`
- `contact_anti_scam`

目标全文来自 `../requirements/COPY.md`。

### 3.2 不可自动替换

管理员已经修改的其它真实内容：

- 不自动覆盖；
- 输出字段名和“需人工 Review”状态，不输出私密业务数据；
- 工作室确认后通过现有管理端保存；
- 隐私政策和服务条款未通过人工 Review 时，不签署需求4发布门禁。

### 3.3 版本

- 隐私政策或处理者名称变化：`privacy_content_version + 1`；
- 服务条款变化：`terms_content_version + 1`；
- about/commission/contact 各自只递增自己的 section version；
- `site_content.version` 同步递增；
- 申请告知版本使用代码常量，不与普通介绍文案共用版本。

## 4. 兼容部署顺序

```text
1. 备份数据库并恢复验证
2. 部署/运行 expand migration
3. 部署兼容 legacy + v2 读取的新镜像
4. 在管理端或受控命令填写真实经营主体名称
5. 核对 contact_email、官方 QQ、QQ群
6. 发布目标隐私政策和服务条款
7. 验证 intake metadata
8. 启用 v2 申请提交
9. 验证部署后新增申请全部为 v2
10. 执行 intake contract，默认值收口为 2
11. 验证旧申请仍可查看/处理
```

停止点：

- 真实经营主体名称为空；
- 官方邮箱为空；
- 隐私政策为空或仍声称网站不收集联系方式/设定图；
- intake metadata 版本与提交 API 不一致；
- 新提交仍能创建 v1，或 contract 后缺确认字段的插入仍可成功；
- PII 进入公开 DTO、HTML、analytics、普通日志或错误；
- 迁移后 `foreign_key_check` 或 integrity 失败。

任何一项成立时，不开放新申请。

## 5. Hero 焦点

需求4不做数据库迁移：

- 复用 `assets.focal_x/focal_y`；
- 已有任意坐标原样保留；
- UI 九宫格写入 0 / 0.5 / 1；
- recipe identity 已含焦点，修改后必须通过既有 publication operation 生成新变体；
- 不直接 UPDATE 已启用 Hero 对应资产后让公开 URL 与数据库身份失配。

如果实现发现同一 asset 被多个 Hero item 复用且需要不同焦点，禁止在本轮静默复制/覆盖。先阻断并登记设计变更；需求4首版以“一张 Hero 资产一个焦点”为边界。

## 6. 人工保留复核

### 6.1 调度

不建设 scheduler。工作室按 SOP 人工执行：

- 失效/失败/取消且未消费上传：至少每月；
- 委托申请总览：至少每半年；
- 用户删除请求：收到后单独执行；
- accepted：业务、保修、争议和法定必要期限结束后逐条确认。

SOP 记录：

- 执行日期；
- 操作员；
- 环境；
- dry-run 计数；
- 批次结果；
- 下一次复核日期。

不记录手机号、QQ、体型、私有图片、完整 Object Key 或可恢复 manifest。

### 6.2 候选口径

自动列候选只允许：

```text
rejected AND handled_at < cutoff
```

其中默认业务 cutoff 为处理满 180 天；实现允许通过明确参数给出日期，不把 180 天写成数据库自动 TTL。

- pending：只列“待人工复核”，不能按时间自动删除；
- accepted：只允许显式 submission ID；
- 用户主动请求：显式 submission ID/receipt 人工核对后执行；
- legal hold/争议：操作员不选入删除批次。

## 7. 精确删除顺序

### 7.1 Dry-run

1. 解析单条或受限批量参数；
2. 查询 submission/session/asset 关系；
3. 检查 asset 是否被作品、Hero、水印或其它 owner 异常引用；
4. 枚举 PRIVATE current objects、variants、preview、pending、versions/delete marker；
5. 输出脱敏计数和候选状态；
6. 不写数据库、不删对象。

### 7.2 Execute

正式执行必须使用 `--execute` 与固定强确认短语，建议：

```text
DELETE COMMISSION APPLICATION DATA
```

顺序：

1. 在数据库关系仍存在时固定精确 ID/Key 到内存；
2. 阻断新写或对目标申请加资源级互斥；
3. 删除 OSS current objects；
4. 删除 versions/delete markers（若启用）；
5. 验证对象不可达；
6. 事务删除/去标识 submission、session、asset variants、asset、直接关联 note/audit；
7. 写最小化删除审计；
8. 再次查询确保零残留。

不得只删数据库后把 OSS 留给未来扫描，也不得先删除关系导致 Key 无法确定。

### 7.3 重入和失败

- 目标对象已不存在：计为幂等完成；
- 数据库行已不存在：单条重入返回“已完成/不存在”，不重新创建；
- OSS 非 NotFound 错误：停止，保留 DB 关系；
- 外部引用异常：停止，不级联猜测；
- DB commit 失败：记录脱敏失败并允许按同一 ID 重入；
- 批量执行逐条串行，不并发删除多个申请。

### 7.4 备份

- 删除可能在受限备份中保留至正常轮换；
- 备份不得用作日常查询或恢复已删除申请；
- 因灾难恢复旧备份后，在服务重新开放前重跑当前删除审计和保留复核；
- 不为删除批次创建包含 PII 的长期导出。

## 8. 第三方声明迁移

无数据库迁移。

实现增加确定性生成输入/产物：

```text
config/third-party-assets.(json|ts)
app/assets/licenses/third-party-notices.json
app/assets/licenses/THIRD_PARTY_NOTICES.txt
```

确切路径可在实现时按 Nuxt 导入约束调整，但必须：

- JSON/TXT 由同一输入生成；
- 不写生成时间；
- 排序稳定；
- npm 事实来自生产依赖；
- FFmpeg、Noto Serif SC、ZhuoHei Collage 由人工 registry 补充；
- 缺失/未知许可证时失败，不猜测；
- `/licenses` 不再维护平行手写运行时数组。

## 9. 回滚

- Schema expand 不做反向丢列回滚；旧镜像兼容性在发布前验证。
- 新提交启用后不得回滚到会创建 v1 或忽略确认版本的旧镜像。
- 文案错误使用新的前向迁移或管理端修正，不改写已执行迁移。
- Hero 焦点通过重新选择旧焦点并重新发布回退，不直接恢复旧对象 Key。
- 删除操作不可逆；只允许在隔离数据、dry-run 和强确认后执行，不以备份恢复作为常规撤销。

## 10. 生产证据

需求4闭环至少保留：

- migration SHA/镜像 digest；
- fresh/既有库/重入/foreign key/integrity 结果；
- 真实处理者配置已就绪的布尔状态，不记录证照详情；
- v2 提交成功和 stale 409 的脱敏结果；
- 隔离申请删除 dry-run/execute/重入计数；
- third-party notices 生成与 drift 校验结果；
- Hero 焦点中心/四角的公开变体验证；
- 发布后 home/privacy/service/licenses/apply/admin smoke；
- 人工复核责任人和下次日期。

证据不得包含申请内容、PII、私有图、完整 Key、token、签名 URL 或聊天记录。
