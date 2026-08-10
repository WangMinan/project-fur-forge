# T52 容器运维认证与参数修复（2026-08-11）

## 结论

本轮确认 `init-admin` 的交互输入、环境变量输入、密码校验和 scrypt 哈希链
均允许 `@`、`!`、`$` 等特殊字符；密码只受 12～256 字符长度约束，不会被
shell 参数解析。首次初始化可以使用特殊字符密码，已有唯一管理员时
`init-admin` 按既有幂等契约返回 `created=false`，不会覆盖现有密码。

截图中的 `reset-admin-password` 失败是发布镜像代码缺陷：容器入口已经解析并
验证 `--confirm RESET_SINGLE_ADMIN_PASSWORD`，但调用
`resetAdminPasswordCommand` 时漏传了同一 `confirmation`，导致服务层再次校验
时必然拒绝。本轮已改为复用服务层确认常量，并把验证后的值继续传入。

实现与本地验证结论为 **PASS**。这不代签 T49-R1 新上下文独立 Review，也不
关闭 T50、GATE-E 或 T53 用户验收。

## 运维入口审计

| 入口 | 结论 |
| --- | --- |
| `migrate` | 不接收业务参数，直接解析当前冻结配置中的数据库路径并执行迁移；没有参数漏传 |
| `init-admin` | TTY 隐藏输入与受控 `ADMIN_*` 环境输入均原样保留特殊字符；已有管理员时不改密 |
| `reset-admin-password` | 已修复确认值漏传；重置后清除锁定并使旧 Session 失效 |
| `backup` / `restore(-verify)` | 路径参数由容器入口直接传给数据库服务，未发现二次校验参数丢失 |
| `preflight` | 容器入口把剩余参数原样传入冻结的 `oss-preflight.mjs`；`--no-dry-run` 使用显式同名选项，链路完整 |
| `cleanup-expired-uploads` | 发现并修复 Node 24 `parseArgs` 未启用 negative boolean，原 `--no-dry-run` 会报 unknown option |
| `reconcile-site-display` | 同上；本地与容器入口均已启用 `allowNegative`，保留默认 dry-run |
| `recover-operations` | 无业务参数，直接运行既有恢复扫描 |

## 回归与发布门禁

- 交互 TTY 与受控环境输入测试使用包含 `@` 等特殊字符的密码，并断言密码不回显；
- 认证 integration 使用特殊字符密码完成 init、幂等重复 init、reset、旧密码失效和新密码登录；
- 本地构建真实 `ops.mjs`，在 27 个迁移的临时库完成 `migrate → init-admin →
  reset-admin-password → 新密码认证`，同时验证 cleanup/reconcile 的
  `--no-dry-run` 已进入业务层而非被参数解析器拒绝；
- `quality.yml` 的真实镜像 smoke 增加含 `@` 的 init 与 reset，并使用重置后的
  密码经 Nginx/管理 Host 登录，防止只验证源码而漏掉生产 bundle；
- lint、typecheck、169 项 unit、172 项单 worker integration、production
  build/guard、production verify、Secret scan、ESA cache、observability、合成
  production preflight dry-run 与 ops bundle 均通过；
- 两次默认并发 integration 均为同一既有 Lanczos 用例超过其 30 秒上限，其他
  171 项通过；该用例单独重放 13.8 秒通过，随后不修改测试和超时，以单 worker
  完整重放 172/172 通过。

用户明确授权本地门禁通过后直接触发 `release-image`，不单独等待 push 触发的
`quality.yml`。发布工作流自身仍调用同 SHA 的 quality reusable workflow，只有
其通过后才会构建并推送不可变 digest；本授权不等于允许绕过发布工作流内门禁。

## 回滚

代码回滚只需撤回本轮容器参数传递、negative boolean 和相应测试/文档；不涉及
Schema 或迁移。已经成功重置的密码是业务数据变更，不能通过镜像回滚恢复；如需
再次更改，必须重新运行带显式确认的离线 reset。发布镜像仍按外部 evidence 中的
`repository@sha256:digest` 精确选择和回滚，不使用 `latest` 作为服务器冻结引用。
