# T52-E2 生产预检 CORS 与旧对象门禁调整（2026-08-10）

> **基线**：`main@a72fc10`
> **性质**：用户明确调整生产预检判定契约；不执行真实云写入，不清理既有对象。

## 用户决策

2026-08-10 live preflight 因以下三项停止：私有 Bucket CORS 不是精确管理 Origin、衍生 Bucket 存在 CORS、衍生 Bucket 中既有本地测试对象未登记在当前生产数据库。用户确认当前排障期保留通配 CORS，并保留 Bucket 中本地测试要使用的旧对象，不执行清理。

## 实现范围

- 私有 Bucket CORS 从“必须唯一、精确 Origin/PUT/Header”改为“管理 Origin 的条件 PUT 能力可用”；精确或通配 Origin/Header 均可通过；
- 不再读取或判定衍生 Bucket CORS；
- 删除衍生 Bucket 全量对象与当前生产数据库 `READY + PUBLIC` 的双向一致性门禁；
- 生产预检不会因既有 `dev/web/**` 或未登记旧衍生对象停止，也不会删除这些对象；
- 证据 Schema 升级为 3，并移除旧检查项名称，避免旧消费者把已取消规则当作有效门禁。

## 保留的安全边界

- 两只 Bucket 仍必须 private + Bucket BPA；Bucket Policy 与逐对象 ACL 不能公开，生命周期规则不能误删生产数据；
- 两只原始 OSS 域名匿名 GET/HEAD 仍必须为 403；
- 管理 Origin 的 OPTIONS/PUT 能力、条件签名、Content-MD5、禁止覆盖、过期签名和 Key 前缀越权拒绝仍验证；
- ESA 必须能读取本次生成的衍生物，且响应不能泄漏 OSS 原站或私有路径；精确 file purge/查询能力仍验证；
- live run 只清理本次运行精确记录的测试对象，不做全桶、前缀或模糊删除。

## 验证

- `pnpm exec vitest run --config vitest.config.ts tests/unit/production-preflight.test.ts tests/unit/oss-preflight.test.ts`：2 个文件、19 项测试通过；
- `pnpm test`：31 个文件、166 项 unit 测试通过；
- `pnpm lint`：通过；
- `APP_ENV=test pnpm typecheck`：通过；
- `APP_ENV=production pnpm build`：Nuxt production build 与内容守卫通过；
- `node scripts/ci-secret-scan.mjs`：486 个 tracked 文件扫描通过；
- `git diff --check`：通过；
- 未运行 `--no-dry-run`，没有访问或修改真实 OSS/ESA。

本次变更属于发布镜像中的预检脚本变更；既有 CI、独立 Review 和镜像不能代签新提交。后续仍需对新 SHA 完成 Actions、独立 Review 并重新发布不可变镜像，才能在远端重新运行 live preflight。
