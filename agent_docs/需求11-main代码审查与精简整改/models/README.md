# 模型说明：main代码审查与精简整改

## 新增模型

F01–F12首轮没有新增表、持久字段或迁移；PR #41补修新增0056，见末节。下表保留整改前模型和处理边界，已实施选择记录在文末。

## 待校准模型

| 意见 | 当前模型 | 拟处理边界 |
| --- | --- | --- |
| F01 | `commission_submissions`：`id`、回执、`version`、`status`、`email_deletion_pending` | 用规范申请 ID 识别同一资源；评估复用持久删除标记，版本/状态检查先于外部删除。邮件栅栏与业务编辑保护要协调。 |
| F03 | publication/reconcile operation 的 lease、attempt、status | 不变更有效租约含义；恢复调度覆盖到期后仍待处理的任务。 |
| F04 | 浏览器内轮询 key、operationId、定时器 | 增补活动/取消身份管理，不能仅以定时器是否存在判断正在轮询；无持久存储。 |
| F05 | 管理 `upload_sessions` 的 status、asset_id、过期时间 | 定义失去执行者的 VALIDATING 恢复策略，兼顾长期核验、已绑定资产与重入；不直接沿用匿名委托清理判断。 |
| F06 | `WorkBasicsForm.sortOrder`、作品写入请求、读取 DTO | 删除无效用户输入与派生校验；读取 DTO 和代表作品集合排序仍有业务用途，不一起删。 |
| F07 | `PUBLIC_FEATURED_LIMIT` | 共享常量为唯一上限来源，当前值5。 |
| F08 | `AdminWorkDto`、`AdminAssetDto` 及旧 mapper/Schema | 已无业务调用，候选删除；真实出口 `ManagedWorkDto`、`VerifiedAssetDto` 和公开 mapper 保留。 |

## 字段处理规则

- 安全和生命周期修复优先复用既有状态；需要新增持久字段时须记录前向迁移和恢复影响，不重写历史迁移。
- F09 的设定图 payload 与封面 crop/focal 等字段保持原有差异；共享状态不能抹平角色约束。
- F10 的校验输入只描述对象身份、预期字节/摘要、格式与尺寸；媒体公开状态、配方和生成仍由原调用方负责。
- F11/F12 仅涉及 UI 内存状态和未使用参数；不新增 localStorage、PII 持久化或后台产品能力。

## 已实施选择（2026-10-08）

- F01：复用 `email_deletion_pending`。在事务内核对 ID/版本/状态/资产关系后置位，所有常规编辑 SQL 要求该字段为0；失败后保留标记供删除重入，不自动解除保护。
- F03：每20秒非重叠扫描，每表最多50个、并发2个；忽略本进程持有的任务，防止慢 OSS 请求被重复启动；只接管其它进程的过期租约。关闭时停止后续定时扫描。
- F05：VALIDATING 期间每20秒按会话版本更新 `updated_at`，连续5分钟没有心跳才转 FAILED（每轮最多200条）；完成提交按状态/版本/asset_id 原子检查。既有取消/重试/清理可接续，没有放宽原图删除边界。
- F06：移除 `WorkBasicsForm.sortOrder`。旧写入请求仍可携带经过校验的可选 sortOrder（兼容接收、继续忽略），当前表单不再发送；读取 DTO 的 sortOrder 仍必填，代表作品集合重排保留。
- F08：删除旧 AdminWorkDto/AdminAssetDto 及仅由测试使用的 mapper/Schema/AssetRecord；真实 ManagedWorkDto/VerifiedAssetDto 的隔离断言保留并补强。
- F09/F11：新增的共享状态仅存在于组件生命周期内；不新增浏览器持久存储或外部接口。

## PR #41补修模型

`commission_submissions.deletion_lease_expires_at` 为可空整数毫秒时间，非空时要求 `email_deletion_pending=1` 且时间为正数。认领增加现有version并写入到期时间，version作为执行凭证；续租/释放/最终提交均匹配该version。迁移本身不修改历史行version及删除标记，历史租约初值NULL。
