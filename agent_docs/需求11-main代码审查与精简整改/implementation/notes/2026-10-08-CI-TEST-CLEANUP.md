# workflow测试冗余清理

## 授权与范围

2026-10-08 用户追加要求检查 `.github/workflows/` 实际使用的测试并清理冗余。本次只修改测试与需求记录，保留此前 F01–F12 未提交修改；不修改业务代码、workflow job、required checks、测试时限或发布门禁，不触发远程工作流。

## 实际调用链

| 入口 | 实际执行 | 本轮判断 |
| --- | --- | --- |
| `quality.yml` 常规 checks | `pnpm check:fast` → lint、typecheck、`test:core` → `tests/unit` 与 `tests/integration` | core 没有在同一 checks job 中重复执行；清理其发现的重复启动与用例 |
| `quality.yml` 的 release 路径 | 在上述 checks 后执行 `test:release`：notices、smoke、ESA策略、可观测策略、secret scan | release 脚本没有再次跑 core；保留各自保护职责 |
| release 中的 production 验证 | `RELEASE_PRODUCTION_VERIFIED_BY_IMAGE=1` 跳过宿主构建/生产验证，由 image-build 负责 | 已有去重机制，不再增加跳过开关 |
| `quality.yml` image-build | 冻结镜像构建、容器依赖、Compose、备份恢复、镜像回滚、Nginx/真实HTTP与投影安全 | 与源码单测、测试构建的环境不同，不按“断言主题相似”删除 |
| `release-image.yml` | 手工授权后调用 `quality.yml(release=true)`，通过后发布镜像并记录digest | 发布流程不在本次改动范围 |
| `tests/e2e` 两个独立用例文件 | 未被当前 `test:smoke` 自动选中 | 不因没有进入本轮CI链路就删除人工专项测试 |

## 已清理项与覆盖去向

| 项目 | 原先冗余 | 处理与保留的保护 |
| --- | --- | --- |
| C01 · 共用运行时夹具 | `auth-api.test.ts` 和 `health.test.ts` 各自 setup、完整构建并启动同一 Nuxt 应用 | 合并为 [runtime-api.test.ts](../../../../tests/integration/runtime-api.test.ts)，一次 setup。保留独立的请求边界组与认证组；边界组先验证迁移基线，认证组每例恢复管理员状态并重置测试限流桶，防止前组的限流测试污染认证结果。构建次数2→1。 |
| C02 · 合并健康成功路径 | “两个Host允许health”与“区分live/ready”重复访问同一公共health端点 | 两个Host、公共health精确响应、readiness/liveness及内部字段不外泄断言保留在同一个用例，HTTP用例19→18。 |
| C03 · 去掉重复业务/迁移成功用例 | FAQ新库检查与database基础用例完全重复；委托确认成功事务与邮件原子事务用例重复 | 删除前者单独用例，保留database新库迁移/幂等/FAQ列不存在检查及R3旧库升级检查；删除后者单独成功用例，把上传CONSUMED和申请计数为1的断言并入commission-email。确认缺失、false、隐私政策不就绪、事务回滚等负路径全部保留。 |
| C04 · 删除实现拼写检查 | deployment-contract 通过源码包含某些局部变量名和`new URL(...)`拼写判断模块内联 | 删除该用例；实际Nitro夹具构建/HTTP启动、媒体处理测试、release镜像依赖加载验证继续保护真正可运行性。其它Compose、Host、隐私、人工发布与恢复契约检查保留。 |
| C05 · 避免跨层重复锁定循环 | HTTP错误隐匿测试再次执行五次密码失败并检查数据库计数 | 直接种入锁定状态，仍真实请求并比较错误密码、不存在用户和已锁定用户的HTTP响应；五次阈值、30分钟与解除锁定继续由auth-core服务测试覆盖。 |

总计删除/合并4个冗余或实现型用例；没有删除独有安全/迁移/恢复断言。fixture数减少不等于减少测试层级。HTTP解析助手同时改为把非JSON响应作为 Promise 拒绝返回，避免在回调中抛未捕获异常后一直等待超时。

## 验证

- `pnpm exec eslint` 定向检查及最终 `pnpm lint`、`pnpm typecheck` 通过。
- `pnpm exec vitest run --config vitest.core.config.ts tests/integration/r3-commission-contract.test.ts tests/integration/commission-confirmation.test.ts tests/integration/commission-email.test.ts tests/unit/deployment-contract.test.ts tests/integration/database.test.ts --maxWorkers=1`：5文件、48测试通过，40.45秒。
- `NUXT_TEST_LOG_LEVEL=3` 下 `pnpm exec vitest run --config vitest.core.config.ts tests/integration/runtime-api.test.ts --maxWorkers=1 --reporter=verbose`：默认生产构建模式，1文件、18测试通过，179.75秒。仅提高日志可见度，没有使用 `NUXT_TEST_DEV`、排除Host检查或调整时限。
- 静态对照旧19个HTTP用例名称，唯一合并项为两个Host的health成功路径，其断言已迁入live/ready用例；新文件只存在一次 `await setup(...)`。
- 原48项定向与18项HTTP范围不交叠；其它未修改测试沿用前轮证据，不声明本轮重新跑过整个core、smoke、镜像或release。
- workflow入口与脚本均未改，因此没有本轮远程CI、Docker/Compose/Nginx或镜像发布结果。默认运行时测试此前未验证通过的限制已被本次18项生产构建模式结果补齐。

## 后续

按当前通用入口执行 `pnpm check:fast` 和显式release流程即可，不再直接调用已合并的两个旧文件路径。前轮文档中的旧命令是历史执行记录，保留原样；当前运行时专项使用 `runtime-api.test.ts`。
