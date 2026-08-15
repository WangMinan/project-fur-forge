# R3-A focused Review（2026-08-16）

## 范围与独立性

- Review 范围：阶段 A 的 T01～T06；不包含生产 T07、GATE-A 或阶段 B/C。
- 首轮被审 SHA：`e3ed0c6`。
- Reviewer：独立新上下文 `Beauvoir`（`r3_a_focused_review`），未参与实现。
- OSS CORS 的 `AllowedOrigin=*` 是既定契约，不是 finding 或门禁。

## 首轮结论：CHANGES REQUIRED

Reviewer 完整阅读需求1媒体/生产基线与需求3活文档，并执行以下 focused 门禁：

- lint：通过；
- typecheck：通过；
- focused unit：7 files / 38 tests，通过；
- focused integration：8 files / 65 tests，通过；
- production build：Reviewer 侧被执行窗口中断，不作为首轮 Review 证据；实现侧已有此前通过记录，修复后仍须重跑。

首轮发现五项 P1：

1. canonical production upgrade 仍可在未执行 R3-A 对象清理时直接 migrate，缺少一次性停写、清理、Contract、净化备份/恢复和旧备份退役顺序。
2. 清理盘点只统计数据库同目录的 `backups/`，遗漏生产应用备份卷 `/app/backups`，也缺少恢复验证后的受控旧备份删除工具。
3. 测试隔离只验证 OSS object key 前缀，没有约束进入 ESA purge 的 URL path 必须落在同一测试前缀。
4. ESA purge task 完成后没有以 HEAD/受限 GET 验证退役 URL 已不可达。
5. `R3_STAGE_A_OBJECT_CLEANUP/SUCCESS` 在最终零残留盘点前写入；若最终盘点失败，会留下错误的 Contract-ready 标记。

## 修复与重测

修复候选在 `e3ed0c6` 之后完成，待提交 SHA 与独立复审结论回填。主要改动：

- 将 R3-A 一次性生产顺序写入 canonical deployment/production handbook，并以契约测试锁定 cleanup 必须早于 migrate；
- 同时盘点 `/app/backups` 和数据库同目录的自动 `backups/`，新增默认 dry-run、强确认 `DELETE R3-A OLD APP BACKUPS` 的重入安全旧备份清理工具；
- ESA URL 必须位于已确认环境前缀，purge task 完成后逐个 HEAD，405/501 时退化为受限 GET，只接受 404/410；
- 最终对象盘点成功后才幂等写入 SUCCESS audit；
- 实际 `ops.mjs` bundle 已验证包含 cleanup、backup prune、ESA 不可达验证和强确认短语。

修复阶段首次失败与处理：

- backup cleanup integration 首跑因自动 migration backup 使预期总数由 2 变为 3；修正断言为 3 个应用备份、2 个旧备份后通过。
- deployment contract unit 首跑误匹配文档更早章节中的普通 `migrate`；将顺序断言限定在 R3-A 4.1 小节后通过。

当前修复 focused 结果：

- lint：通过；
- typecheck：通过；
- R3-A remote cleanup + deployment contract unit：2 files / 12 tests，通过；
- R3-A cleanup integration：1 file / 8 tests，通过；
- `pnpm ops:build`：通过，bundle 内容检查通过。

## 复审

待同一独立 Reviewer 基于修复后 SHA 复审。未获得其 PASS 前，T06 保持未完成。

### 独立 Reviewer 复审结论：PASS

- 复审 SHA：`3e0efa7f3bdf64fc950288e5cf9313956f46eff6`；比较范围：`e3ed0c6..3e0efa7`。
- Reviewer：同一独立上下文 `Beauvoir`（`r3_a_focused_review`）；未参与修复实现。
- 复审未访问生产数据库、OSS 或 ESA，未执行生产清理、备份删除、提交或历史改写。

五项首轮 P1 均已关闭：

1. `scripts/container-ops.ts` 已把 cleanup 和 backup prune 纳入同一生产 `ops.mjs` bundle；`docs/DEPLOYMENT.md` 的 R3-A 一次性路径固定为停写 → dry-run → 媒体强确认清理/不可达验证 → Contract → 服务验证 → clean backup/真实恢复 → 旧备份强确认删除，普通升级路径被明确排除。
2. `server/utils/runner/r3-stage-a-backup-retirement.ts` 同时盘点生产 `/app/backups` 与数据库同目录 `backups/`，缺少生产备份卷即拒绝；旧备份删除默认 dry-run，要求精确短语 `DELETE R3-A OLD APP BACKUPS`，保留已验证 clean backup，并验证删除后只剩该备份。隔离 integration 也覆盖恢复验证、错误确认拒绝、删除和零结果重入。
3. `server/utils/runner/r3-stage-a-retirement.ts` 要求 operation 中的 ESA URL 与媒体 origin 一致且 pathname 位于已确认的 `environmentPrefix`；测试前缀越界在任何 OSS inventory/purge 前失败。
4. `server/utils/r3-stage-a-remote-cleanup.ts` 在 ESA task `Complete` 后逐 URL 执行 HEAD；仅在 405/501 时退化为带 Range 的 GET，且只接受 404/410，仍可达或 task 失败均阻断 Contract。
5. `R3_STAGE_A_OBJECT_CLEANUP/SUCCESS` 已移到最终 OSS inventory 的 current/version/delete-marker 全零检查之后，并以幂等写入实现；失败注入证明最终 inventory 抛错时不会留下标记。

Reviewer 独立执行结果：

- `$env:APP_ENV='test'; pnpm lint`：PASS。
- `$env:APP_ENV='test'; pnpm typecheck`：PASS。
- `$env:APP_ENV='test'; pnpm exec vitest run --config vitest.config.ts tests/unit/r3-stage-a-remote-cleanup.test.ts tests/unit/deployment-contract.test.ts`：2 files / 12 tests，PASS。
- `$env:APP_ENV='test'; pnpm exec vitest run --config vitest.integration.config.ts tests/integration/r3-stage-a-cleanup.test.ts`：1 file / 8 tests，PASS。
- `pnpm ops:build` 及 bundle marker 检查：PASS；bundle 含两个 R3-A 命令、两条强确认短语、ESA 不可达错误和 `/app/backups` 路径。
- `git diff --check e3ed0c6..3e0efa7`：PASS；复审写入前工作树无实现代码改动。

结论：修复后 SHA 的 R3-A T01～T06 focused Review 为 **PASS**，首轮五项 P1 均已闭环，未发现新的 Stage A release blocker。该 PASS 只覆盖本地工程复审，不代表生产 T07 已执行，不代签 GATE-A、用户验收、发布镜像或该 SHA 的远端 CI；这些生产交接项继续保持开放。
