# 需求3 · 实施记录与证据

> **角色**：保存需求3各任务的 dated engineering note、Review 修复记录和脱敏验收证据。
> **权威边界**：本目录只记录当时事实，不能覆盖 `requirements/SPEC.md`、`planning/PLAN.md` 或 `implementation/TASKS.md`。

## 命名

建议：

```text
T01-BRAND-2026-08-XX.md
T10-HOME-HERO-2026-08-XX.md
T22-COMMISSION-SUBMISSION-2026-08-XX.md
T29-LOCAL-DESTRUCTIVE-DRILL-2026-08-XX.md
T36-PRODUCTION-RETIREMENT-2026-08-XX.md
```

同一任务多轮修复可以增加 `-F1`、`-F2` 或按主题拆分，但不能通过改写旧 note 隐藏首次失败和 finding。

## 每份记录至少包含

- 对应 TASK ID、分支和提交 SHA；
- 修改范围与明确未修改范围；
- 数据迁移或 API/页面契约；
- 实际测试命令、首次结果、根因和修复后结果；
- 真实浏览器 Host、视口、截图/trace；
- 并发、失败、恢复、reduced-motion、键盘和网络检查；
- 独立 Review 或用户后续项；
- 是否改变生产清理或回滚边界。

## 隐私与删除证据红线

不得写入本目录：

- 手机号、QQ、称呼、身高、体重、内部备注；
- 委托设定图、返图原图或动态正文；
- 完整 OSS Object Key、签名 URL、AK/SK、Session Secret；
- 可还原用户数据的 CSV、JSON、SQL dump 或 manifest；
- 生产数据库备份或清理临时文件。

允许保存：

- 数量、总字节、迁移版本、退出码、脱敏 ID；
- `foreign_key_check` 行数、`integrity_check=ok`；
- ESA purge 数量和成功/失败状态；
- 路由 404、表不存在、对象不可达的断言结果；
- 使用虚构数据的 UI 截图和 trace。

## 生产破坏性记录

T36 的生产 note 必须明确：

- dry-run 计数由用户核对；
- 强确认短语由用户输入；
- 对象删除完成时间；
- contract migration 版本；
- 净化备份校验；
- 服务恢复结果；
- 数据不可恢复且旧镜像不再兼容。

不得把“脚本准备完成”写成“生产永久删除完成”。
