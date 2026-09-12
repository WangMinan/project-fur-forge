# 数据库迁移与恢复

仅在目标更新含 migration、明确停写要求、恢复或破坏性运维时读取。

## 迁移前判定

1. 阅读新增 SQL、`meta/_journal.json`、schema 和目标需求的生产迁移说明；列出新增、改写、删除、回填、媒体/云副作用和回滚兼容性。
2. 用当前运行镜像只读记录活动库：`integrity_check`、`foreign_key_check`、migration 数、目标迁移依赖的基线行，以及会受影响的核心表计数。字段名以 `server/database/schema.ts` 为准，不猜列。
3. 从目标 runbook 得到预期起始 migration、首次 `applied` 数、是否停写及迁移后守恒条件；不要硬编码历史计数。

## 普通前向迁移

若目标说明允许在线迁移，使用目标冻结镜像：显式备份 → migrate → 数据/约束校验 → 仅重建 `app`。若说明要求停写，则在镜像核验完成后：

```bash
docker compose stop app
test -z "$(docker compose ps --services --status running)"
docker compose run --rm --no-deps app node ops/ops.mjs backup --output "$BACKUP_FILE"
# 在 migrate 前，用与备份 migration 集匹配的旧冻结镜像完成 restore-verify。
APP_IMAGE_REF="$OLD_IMAGE_REF" docker compose run --rm --no-deps app \
  node ops/ops.mjs restore-verify \
  --backup "$BACKUP_FILE" --output /tmp/pre-migration-verify.db
docker compose run --rm --no-deps app node ops/ops.mjs migrate
```

- 显式备份未经匹配旧镜像 `restore-verify`，或至少未经只读 integrity/FK/migration-history 验证，不得开始 migrate。
- app 保持停止，直到首次迁移结果、FK/integrity、目标 schema/seed 和旧数据守恒全部通过。
- runbook 要求幂等复跑时，第二次必须为 `applied=0`。
- 比较迁移前备份与活动库的旧字段和不应变化的核心表计数；新表/列/seed 按目标 SPEC 验证。
- 迁移入口可能另外创建自动 `pre-migrate` 备份；显式备份仍必须保留。

## 严格 migration 历史

`server/utils/database.ts` 的 `restore-verify` 同时要求 integrity、FK 和“与执行它的镜像完整 migration 集一致”。因此：

- 新镜像对迁移前备份报 `Restore source does not match the current migrations` 通常是版本不匹配，不等于备份损坏。
- 用该备份所属的旧冻结镜像验证：

```bash
APP_IMAGE_REF="$OLD_IMAGE_REF" docker compose run --rm --no-deps app \
  node ops/ops.mjs restore-verify \
  --backup "$PRE_MIGRATION_BACKUP" --output /tmp/restore-verify.db
```

- 宿主机没有 `sqlite3` 时，使用匹配冻结镜像内的 `better-sqlite3` 做只读 integrity/FK/计数检查。
- `restore-verify` 只写新的验证路径；恢复也必须写新数据库路径，绝不覆盖活动数据库。

## 破坏性迁移和媒体退役

- migration 若删除表/行、公开媒体、OSS version/delete marker 或触发 ESA purge，普通部署授权不足。先停止并请求精确的额外授权。
- `0051_r4_retire_watermark.sql` 只能走 `docs/DEPLOYMENT.md` 5.1：停写 → 显式备份 → migrate → 退役 dry-run → 单独媒体删除授权 → 强确认执行 → 第二次 migrate → app-only 重建 → DB/recipe-v4/媒体/公网验证。
- 执行期间保持 app 停止；中断后从幂等命令重入。回滚需要旧镜像、迁移前数据库和 OSS 对象版本，不能只换镜像。

## 失败和回滚

- migration 失败后先确认事务是否回滚并检查活动库 migration history、integrity/FK；不要立即启动不兼容的旧镜像。
- 已有前向 migration 时，旧镜像可能主动拒绝新数据库。功能回退优先发布兼容新 schema 的修复镜像。
- 真正回到旧版本需要新的恢复授权：停止 app，用匹配旧镜像验证迁移前备份，恢复到新路径，评估并保全备份后的新写入，再同时切换 `DATABASE_FILE` 和旧 digest。
- 数据库恢复、备份删除和媒体恢复分别属于额外的破坏性权限。
