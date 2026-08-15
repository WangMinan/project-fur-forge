# 需求3 · 数据迁移与永久退役方案

> **角色**：规定当前 Schema 到目标 Schema 的发布单元、删除顺序、停止点与验证。
> **警告**：第一发布单元包含用户明确授权的返图/动态不可恢复删除。
> **修订**：返图/动态退役提前到第一阶段；修正备份顺序、领养状态映射和 Hero collection 并发模型；官方渠道收缩为两项；OSS CORS 保持通配且不作门禁。

## 1. 发布单元

本需求拆为五个单元：

1. **R3-A · 立即退役与渠道收缩**：返图/动态代码、表、媒体和入口永久删除；官方渠道收缩为邮箱、QQ、QQ群；
2. **R3-B · Expand**：Hero collections/items、adoption status/cover、commission models/upload；
3. **R3-C · 页面迁移**：Hero、作品、领养和委托 UI/API 切换；
4. **R3-D · Works contract**：删除作品旧列和 tags；
5. **R3-E · 最终发布**：质量、独立 Review、用户验收和生产部署。

R3-A 完成后，返图、动态和三类取消平台联系方式不得继续存在到其它阶段。

## 2. R3-A：立即永久退役与渠道收缩

### 2.1 代码先行

> 2026-08-15 T01～T02：已新增 `0035_r3_a_brand.sql`，只把空值或旧默认 slogan 更新为 `不只做小狗毛 | 只做海绵头`，不覆盖管理员已自定义值；返图/动态活动代码和三类退役渠道活动契约已删除。旧 SQLite 五槽 CHECK 会拒绝两槽写入，退役/渠道持久 Contract 仍属于 T04，清理前不得执行。

在删除数据库前，新镜像必须已：

- 删除公开/管理返图与动态页面、API、导航、首页动态摘要；
- 删除返图/动态 Schema、repository、service、runner、recipe、fixture、测试；
- 更新 sitemap、analytics、production verify 和内容守卫；
- 旧路由返回 404；
- 不再启动任何 return/update operation；
- 把联系平台常量、Schema、DTO、后台 Card 和公开 Grid 收缩为 `qq | qq_group`；
- `/about` 只显示邮箱、QQ、QQ群；`/commission` 只显示 QQ、QQ群；
- 不再加载抖音、小红书、Bilibili Logo 或二维码。

### 2.2 dry-run

停机前工具只读计算：

- updates、return characters、return photos 行数；
- return assets、upload sessions、variants、operations、analytics 行数；
- 私有 original/preprocess/preview、public variants、pending objects 数量和总字节；
- ESA 精确 URL 数量；
- OSS versioning 状态及相关 version/delete marker 数量；
- `official_channels_json` 中 qq/qq_group/douyin/xiaohongshu/bilibili 项数与二维码引用数；
- 三类取消平台对应、且确认无其它引用的 `contact_qr` assets/variants/object 数量；
- 应用管理备份数量；
- 外部快照检查项（只报告“需操作员确认”，不猜测位置）。

输出不得包含标题、正文、名称、账号值、alt、PII 或完整 Object Key。

### 2.3 精确枚举

在仍存在的数据库关系上，按顺序枚举：

1. `return_photos.asset_id`
2. `assets.private_object_key`
3. `asset_variants.object_key` 与 source
4. `upload_sessions.private_object_key`
5. publication/cleanup operation 中的 Key
6. 对应 ESA URL
7. `official_channels_json` 中三个取消平台的 `qrCodeAssetId`
8. 这些二维码资产的 private/preprocess/public object 与 ESA URL
9. 应用管理备份清单

联系二维码只在确认资产没有被 QQ、QQ群或其它允许关系引用后纳入删除。

临时 manifest 只允许内存或权限受限临时目录，结束后删除，不进入仓库、日志或长期 evidence。

### 2.4 删除与 contract 顺序

1. 停止应用和所有写入；
2. 重新执行 dry-run，用户核对计数；
3. 输入返图/动态强确认短语；
4. 删除 pending return upload objects；
5. 删除 return private preview/preprocess；
6. 删除 return private originals；
7. 删除 return public variants；
8. 删除对应 OSS versions/delete markers；
9. ESA purge；
10. HEAD/GET 验证 return 对象不可达；
11. 移除三类取消平台的 JSON 项与二维码引用；
12. 删除确认无其它引用的三类平台 QR private/preprocess/public objects、versions 与 ESA cache；
13. 执行 R3-A 数据库 contract transaction；
14. foreign key / integrity / production verify；
15. 启动新镜像并验证退役路由 404、联系页面只剩邮箱/QQ/QQ群；
16. 创建新的净化备份并完成恢复验证；
17. 删除仍含退役数据的旧应用管理备份；
18. 操作员确认外部主机/云盘快照策略。

若步骤 4–12 任一对象删除失败，禁止进入步骤 13。若数据库 transaction 失败，数据库回滚，但已删除媒体不会恢复，只能修复新镜像后重试。

### 2.5 R3-A 数据库 contract

第一阶段重建受影响表并删除：

```text
updates
return_characters
return_photos
return assets / upload sessions / variants / operations / analytics rows
return_photo enum
return owner branch
return-wall
return-display-v1
RETURN_PHOTO
returns / return_character / updates analytics keys
contact platform douyin
contact platform xiaohongshu
contact platform bilibili
contact_douyin legacy column
```

`official_channels_json` 迁移目标：

```text
[
  { platform: 'qq',       account, qrCodeAssetId },
  { platform: 'qq_group', account, qrCodeAssetId }
]
```

规则：

- 按 platform 提取，不依赖旧数组下标；
- 缺少 qq 或 qq_group 时迁移阻断，不制造空假账号；
- 三类取消平台直接丢弃，不导出、不转备注；
- contact 分区版本与全局版本按一次受控迁移递增；
- `contact_qq` 兼容列不在本阶段强制删除；
- 本阶段不等待作品字段重构，也不删除 works 的 suit/owner/event 等列。

## 3. R3-B：Hero Expand

### 3.1 创建 collection

插入固定四行：

```text
home/landscape
home/portrait
commission/landscape
commission/portrait
```

每行有独立 version。

### 3.2 旧 pair 拆分

对每条 `site_hero_slides`：

```text
old.id + landscape -> landscape item
old.id + portrait  -> portrait item
```

- 使用确定性 ID，重复执行不重复；
- 保留 placement、alt、sort、enabled、时间；
- linked work 丢弃；
- 预览 Key 清空并按 item 重建；
- 每个 collection 按旧 `sort_order,id` 归一化；
- collection version 初始化为 1 或迁移定义值。

删除旧表前必须验证：

- 新 item 数为旧有效行的两倍；
- 每个旧 asset 在对应 orientation 恰好出现一次；
- 四个 collection 的公开/管理读写已切换；
- 上传 owner context 和 expectedVersion 已切换；
- 三视口横竖请求正确。

## 4. R3-B：作品与领养 Expand

### 4.1 新字段/角色

- `works.adoption_status` nullable；
- `assets/work_assets` 增加 `adoption_cover`；
- `asset_variants` 增加 `adoption-card`；
- 管理上传/发布/清理链支持 cover；
- 旧字段暂时保留。

### 4.2 状态映射

安全自动映射：

```text
available -> available
delivered -> adopted
```

歧义值保持 NULL：

```text
preparing
scheduled
in_production
event_sale
NULL
```

生成只含计数和内部 ID 的后台复核清单，不写仓库。景宸逐条确认后保存目标状态。contract 前 NULL 必须为 0。

### 4.3 cover 补齐

- 不自动从 studio photo 或 design sheet 生成；
- published adoption 必须人工上传 cover；
- 无法补齐则先下架；
- `adoption-card` SourceSet 必须完整。

## 5. R3-B：委托 Expand

创建：

```text
commission_upload_sessions
commission_submissions
commission_design_reference role
```

同时完成：

- 独立匿名限流；
- 应用 API Origin/Content-Type/body/token/TTL/蜜罐；
- 条件 PUT 与 complete；
- 私有预览；
- 过期/失败清理；
- PII 泄漏负向测试。

OSS CORS 规则：

- 保持现网 `AllowedOrigin=*`；
- 不新增 public/admin 精确 Origin 收紧迁移；
- 不把 wildcard 当作 CI、验收或生产 blocker；
- 条件 PUT 继续签入实际所需 headers；
- 浏览器上传不使用 Cookie 或 credentialed CORS；
- 端到端测试只验证签名 PUT/complete 可用，不断言其它 Origin 被 OSS CORS 拒绝。

## 6. R3-C：页面切换

按顺序：

1. Hero 公开 DTO/管理页切 collection；
2. `/works`/详情切简化 DTO；
3. `/adoptions` 切 cover 和新状态；
4. `/commission/apply`、管理队列上线；
5. FAQ 链删除，邮件主行动降级；
6. `/about`、`/commission` 再确认只消费邮箱/QQ/QQ群；
7. 三视口、真实手机、reduced-motion 和 PII 验证。

## 7. R3-D：作品 contract

仅在以下条件满足后执行：

- 所有 adoption_status 非 NULL；
- published adoption 缺 cover = 0；
- published works 缺 primary studio photo = 0；
- 新页面/API 不读取旧列；
- 管理端不提交旧字段。

重建 `works`、`work_assets`、相关 DTO/Schema 并删除：

```text
suit_type
owner_display
owner_contact
adoption_method
business_status
event_name
event_time
work_feature_tags
```

保留价格、purpose、publication、featured、sort、时间和图片。

`commission_email_action` 和 `contact_qq` 兼容列不在该 contract 中删除；`contact_douyin` 已在 R3-A 删除。

## 8. 备份与快照

### 8.1 应用管理备份

- R3-A 前不创建新的长期退役数据导出；
- 现有备份暂存到净化备份验证完成；
- R3-A contract 成功后立即创建净化备份；
- 使用 `db:restore` 或等价流程验证；
- 之后删除旧应用管理备份；
- evidence 只记录数量、大小、时间和验证结果。

### 8.2 外部快照

ECS/云盘/供应商快照可能不在仓库或应用权限内。生产手册必须列为显式操作员检查项。Agent 不得声称已删除无法访问的外部备份。

## 9. 停止点

### STOP-1：dry-run 不符

数据库行数、对象数、版本数、取消平台引用数或备份数与预期不符时停止。

### STOP-2：对象删除不完整

任何 return original/variant/version/delete marker/ESA purge，或应删除的取消平台 QR 对象未完成时，禁止对应数据库 contract。

### STOP-3：净化数据库验证失败

foreign key、integrity、readiness、production verify 失败时保持停机，使用目标 Schema 兼容的新镜像前向修复。

### STOP-4：领养迁移不完整

任何 adoption status 为 NULL、published adoption 缺 cover 或 published work 缺 primary photo 时，禁止作品 contract。

OSS CORS 保持 `*` 不属于停止点。

## 10. 测试矩阵

### R3-A

- 空/复杂 return 数据；
- pending upload、failed variant、active/failed operation；
- versioning off/on 模拟；
- dry-run、强确认、部分失败、重复执行；
- 五平台 JSON 各种完整/缺失组合到两平台迁移；
- 三类取消平台 QR 引用和孤立资产清理；
- 404、sitemap、analytics、production guard；
- `/about` 只显示邮箱/QQ/QQ群；
- clean backup restore。

### Hero

- pair 拆分幂等；
- collection version 独立；
- stale collection 409；
- upload owner context；
- SSR/hydration/orientation change。

### Works/adoption

- 清晰/歧义状态；
- cover 缺失阻断；
- DTO 负向字段；
- works contract 空库/既有库；
- design sheet optional。

### Commission

- create/PUT/complete/consume；
- token/TTL/重复/限流/蜜罐；
- 应用 API Origin 校验；
- 在现有通配 CORS 下的签名 PUT smoke；
- private preview；
- PII leakage；
- admin status/note/409。

不测试或要求 OSS 按精确 Origin 拒绝请求。

## 11. 最终验证

```text
R3-A 后：
  updates/return tables 不存在
  return enums 不可插入
  return objects/versions 不可达
  old routes 404
  official_channels_json platforms = [qq, qq_group]
  douyin/xiaohongshu/bilibili 不可写入
  contact_douyin 列不存在
  retired channel QR orphan count = 0
  about visible contacts = email + QQ + QQ群
  clean backup restore pass

R3-D 后：
  work_feature_tags 不存在
  旧 works 列不存在
  adoption_status NULL = 0
  published adoption 缺 cover = 0
  published work 缺 primary studio photo = 0

全程：
  foreign_key_check = 0 rows
  integrity_check = ok
  commission private asset PUBLIC variants = 0
  Hero enabled count per collection = 1..5
  OSS CORS AllowedOrigin = *（信息项，不是门禁）
```

## 12. 回滚与前向修复

- R3-A 返图媒体删除后无返图数据回滚；
- R3-A contract 失败时 DB transaction 可回滚，已删除媒体不可恢复；
- 取消平台数据不建立隐藏归档；若迁移失败，在 contract transaction 回滚后用旧数据库修复并重试；
- R3-B Expand 可普通回滚；
- R3-D contract 成功后旧镜像不保证兼容；
- 不为“回滚”保留退役媒体、空表、兼容视图或隐藏归档。
