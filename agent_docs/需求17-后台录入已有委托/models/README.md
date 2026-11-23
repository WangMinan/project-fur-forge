# 模型说明：后台录入已有委托

模型已通过前向迁移0058及本地代码实现；0059补齐既有取消服务所需的COMPLETED→CANCELLED上传状态转换，CONSUMED仍不可取消。下方现状为改动前基线，字段表为领域映射。已在隔离测试库验证，未修改生产库。业务权威见 [SPEC](../requirements/SPEC.md)。

## 现状

- `commission_submissions` 要求手机号、QQ、身高、体重、设定图非空；species已允许历史空值。
- `commission_submissions_pending_phone_unique` 是全部pending的手机号唯一索引。
- accepted/rejected要求非空handled_at/handled_by；当前created_at是系统提交时间。
- 设定图引用有唯一性、角色/READY触发器；上传有一次消费、TTL与关系校验。删除链默认有图和上传关系。

## 字段映射

| 领域 | 处理 |
| --- | --- |
| origin | website / manual，旧记录回填website，服务端按入口赋值且不可编辑 |
| channel / channelLabel | manual必填qq/wechat/other；other额外名称，website为空 |
| phone / qq / height / weight / designAssetId | manual允许NULL；有值仍校验；website保留完整性，物种旧空值例外保留 |
| otherContact | manual可空文本，联系方式至少一项；不解析/建客户档案 |
| originalAppliedOn / historicalHandledOn | 可空YYYY-MM-DD，日期语义，无时区转换成午夜时间戳 |
| createdAt / updatedAt / handledAt / handledBy | 保留系统事件语义；manual直接已处理时记当前管理员和真实操作时间 |
| offlineAdultConfirmed / offlinePrivacyConfirmed | 仅manual使用，默认false，accepted需true；website旧数据不伪造线下确认 |
| createdBy | manual创建管理员；website为空，不反推历史管理员 |
| createRequestId | manual一次创建的唯一操作身份；不能复用已完成身份创建另一笔 |
| receiptCode / id / version | 保留原身份与并发域；仅管理文案称申请编号 |

图片引用为空时跳过有图关系校验，有图仍严格检查。旧website行依旧有效，不为本期新增确认字段伪造证据。详情与制作单用可空类型；公开创建Schema保持严格。

## 防重与并发

- 人员查重：规范化手机号/QQ的OR精确匹配，返回去重的申请集合；修改排除自身。无需人员主表或长期唯一联系方式。
- 后台最终写事务内比对已确认的联系方式及命中ID/版本集合；匹配发生变化重新返回业务冲突。避免无条件的永久allowDuplicate开关。
- 请求防重：持久化createRequestId与成功申请的对应关系。同一请求重放先返回已保存结果，再考虑上传消费和人员查重；已完成键不能用于不同创建意图。只支持当前录入流程重试，不建设通用幂等平台。
- 已使用独立 `commission_create_requests` 表保存请求身份/操作者/创建内容摘要及申请关联；删除触发器清空摘要，FK置空申请关联，重放返回稳定拒绝；已删除成功申请不得被旧请求重建。最小持久标记只保留无PII的请求身份/终态，不保存已删申请正文。
- 现有pending唯一索引须由前向迁移调整；可限定website pending唯一，同时在公开写事务中查询全部来源pending。后台可确认插入，公开不能绕过已有manual pending。用真实SQLite并发用例验证，不能仅移除索引。

## 邮件与媒体

- 新增管理邮件摘要语义 `not_applicable`（显示“无需邮件”）；由manual来源推导，不插入虚假发送记录。重试、enqueue、发送前复核及恢复均保证manual不发信。
- 管理上传需标记用途与授权归属，禁止匿名会话被管理写直接消费。继续复用图片验证和一次消费逻辑。
- 替换先保留旧图，提交引用后持久安排旧图清理；无图、未消费、替换失败、中断均有恢复路径。旧图保留原CONSUMED状态并写入retired_at，禁止再次消费；原清理入口识别已脱离引用的retired记录，使用精确ObjectStore删除全部版本并检查无残留后删除DB关系。失败继续保留重入依据。旧图不进入公开资产链。

## 迁移与回归范围

新增前向迁移、同步Drizzle Schema/DTO/类型；若SQLite重建表，完整保留FK、触发器、索引、编号及旧行。检查上传消费约束、删除lease、邮件引用与处理时间约束。只有新manual记录允许新增空值，不静默放宽公开输入校验。迁移不运行在生产，待后续发布任务按冻结版本手册执行。
