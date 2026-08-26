# Release runner pnpm invocation fix

## Failure

- `release-image` run `32989901142` 的 authorize 与 fast checks 通过；`quality / checks` 在 release verification 失败，publish 未执行。
- GitHub Actions 中 `npm_execpath=pnpm`，旧 runner 无条件执行成 `node pnpm ...`，Node 因而尝试加载仓库根目录下不存在的 `pnpm` 模块。

## Fix

- 新增共享 `pnpmInvocation`：`.js/.mjs/.cjs` 入口继续由当前 Node 执行，命令名或可执行路径直接执行。
- `run-release-tests.mjs` 与 `third-party-notices.mjs` 统一使用该解析，避免 release runner 修好后 notices 在同一缺陷上再次失败。
- 单元回归覆盖 CI 命令名、JavaScript 入口和缺失 `npm_execpath` 三种状态。

## Validation

- `pnpm check:fast`：54 files / 320 tests 通过。
- `pnpm test:release`：notices、11/11 smoke、production build/verify、ESA cache、security/observability 与 Secret scan 全部通过。

## Boundary

- 本修复不改变 workflow 输入、发布确认、镜像标签、Docker Hub 目标或部署契约。
