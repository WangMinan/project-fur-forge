# R3-A T07 容器 CLI 交接修复（2026-08-16）

## 范围与授权

- 任务：T07 生产永久退役前的冻结镜像阻断修复。
- 分支：用户明确授权本次直接在 `main` 修改、提交、推送和出包。
- 生产边界：本提交只修复运维入口与 CI smoke，不执行数据库迁移、媒体删除或备份清理。

## 首次生产 dry-run finding

冻结镜像 `472a884` 使用文档命令执行 `r3-stage-a-cleanup` 时，先输出
`Unexpected argument 'r3-stage-a-cleanup'`，随后仍输出脱敏 dry-run JSON，
但最终退出码为 1。按生产停止条件，未继续正式删除或 migration；旧镜像服务已
恢复健康。首次盘点只记录脱敏数量：retired channel entries 3、retired account
1、analytics 37、应用备份 15，其余退役媒体/对象/version/delete marker 为 0。

## 根因与修复

`r3-stage-a-cleanup.ts` 与 `r3-stage-a-prune-backups.ts` 同时承担可导入实现和
独立 CLI。esbuild 将它们内联进 `ops.mjs` 后，`import.meta.url` 与容器入口路径
相同，两个模块误判为直接执行，将顶层子命令当作自己的 positional argument，
并提前设置非零退出码。

修复将本地 `tsx` 入口拆为独立 `*-cli.ts` 包装器；容器 bundle 只导入无副作用
实现。Actions image smoke 真实调用两个 `ops.mjs` 子命令的 usage 失败路径，要求
稳定业务提示且不得出现 `Unexpected argument`。

## 生产交接

- 新冻结镜像必须重新执行同一生产 dry-run；旧输出不代签新镜像。
- 正式清理继续要求 `--execute --confirm "DELETE R3-A RETIRED MEDIA"`。
- migrate 只在正式清理退出码为 0 且 `contractReady=true` 后执行。
- 净化备份恢复通过后，才可执行旧应用备份强确认清理。
- 外部 ECS/云盘快照继续记录为操作员控制台责任，应用不得虚报处理完成。

## 本地门禁

- `pnpm exec vitest run --config vitest.config.ts tests/unit/deployment-contract.test.ts`：10/10 通过；
- R3-A cleanup integration：8/8 通过；
- lint、提高 Node heap 后的 typecheck、`pnpm ops:build`：通过；
- 首次并行完整 unit 因 1.6 GiB 主机资源争用出现两个 5 秒超时，相关 7 项随后以单 worker 重跑全部通过；
- 用户要求停止继续运行本地完整 unit/本地 Docker build，直接推送后以 GitHub Actions 的完整 quality 和真实镜像 one-shot smoke 为发布门禁。
