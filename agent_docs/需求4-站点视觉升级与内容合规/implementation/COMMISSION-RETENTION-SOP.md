# 委托申请保留、复核与单条删除 SOP

> **性质**：本文件只维护人工流程、建议频率和停止点。不建设 scheduler、cron、提醒系统或生产执行台账，也不填写虚构的执行日期、操作员或结果。

## 1. 频率与范围

- 至少每月人工运行一次失效/失败/取消且未消费上传清理；默认 dry-run，核对脱敏计数后才允许显式写入。
- 至少每半年复核一次申请：rejected 拒绝后立即成为删除候选；pending 只提示人工复核；accepted 不按时间自动进入候选。
- 用户查询、更正或删除请求单独受理，不等待周期复核。

## 2. accepted 人工判断

accepted 只在工作室确认下列直接相关期限全部结束后才进入单条删除决策：委托履行、签收后一年保修、未结争议/投诉以及法律法规要求的必要保留期。存在合法保留理由时停止删除，不由时间规则自动覆盖。

## 3. 单条 dry-run

管理端在 `/admin/commissions` 对 rejected 申请使用“删除申请数据”。CLI 等价命令：

```powershell
pnpm commission:retention -- --identifier <submission-id-or-receipt>
```

pending/accepted 只在工作室已完成用户权利请求、保修/争议/法定期限等人工判断后，由 CLI 显式加 `--manual-approved` 预览；管理 UI 不开放该覆盖。

dry-run 必须只显示脱敏数据库行数、私有对象/current/version/delete marker 计数和稳定阻断原因。不复制、截图或导出手机号、QQ、体型、内部备注、文件名、Object Key、token、签名 URL 或完整 ID。

任一阻断原因出现时停止，尤其是作品、Hero、水印、其它 owner/申请引用，非 PRIVATE 变体，上传会话/资产关系异常，或 OSS 盘点失败。

## 4. 单条 execute

管理端在同一脱敏 dry-run 对话中再次确认。CLI 要求固定强确认：

```powershell
pnpm commission:retention -- --identifier <submission-id-or-receipt> --execute --confirm "DELETE COMMISSION APPLICATION DATA"
```

pending/accepted 的人工批准执行还必须同时加 `--manual-approved`；它不改变单条和固定强确认门禁。

- 每次只处理一条；不提供多选、状态+时间批量 execute 或“一键清空”。
- 按已盘点的精确 Key 删除 current、versions 和 delete markers；NotFound 作为幂等继续，其它 OSS 失败立即停止且不删数据库关系。
- 对象零残留复核通过后，才事务删除 submission、commission upload session、design-reference asset、PRIVATE variants 和带完整 ID 的旧审计关系；新审计只保留不可恢复的 ID 摘要、结果和时间。
- DB 提交失败后不猜测修补；使用同一条标识重新 dry-run/execute，已经不存在的对象幂等继续。

## 5. 备份恢复后

删除数据可能在受限备份中保留至正常轮换，但备份不作日常查询或恢复已删申请。灾难恢复到新路径后，在重新开放服务前重跑当前保留候选和已受理的用户删除请求；不把备份恢复当作常规撤销手段。
