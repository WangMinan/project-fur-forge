# T52-E3 工程记录 · ESA 同账号私有 OSS 回源公开投影

- 日期：2026-08-09
- 基线 commit：`8ab305ac3a898d353770ef1c3682ab290c4ffb21`
- 角色：阶段 E 实现者自测
- 结论：**PASS WITH FOLLOW-UP**

## 范围与边界

本轮只收敛业务应用的公开媒体投影和对应自动门禁。生产公开 SourceSet、SSR 与 API 继续通过唯一媒体映射入口组装稳定 ESA HTTPS URL；业务应用不申请或保存 ESA 回源 STS，不新增自定义边缘 URL 鉴权、媒体鉴权 Key/TTL 或边缘函数。

T52-E2 已冻结的 live preflight 继续负责真实 Bucket/ESA 的匿名 403、已发布媒体 200、网页衍生 Bucket 全量清单和控制面权限检查。本轮没有使用真实生产 Secret 或写入阿里云资源，因此不声称生产回源已经 live 通过。管理端登录、Session、Host/Origin/CSRF 代码和契约未修改。

用户确认的英文品牌保持完整 `DITE DOG FURSUIT`；实现常量没有改名，production verify 继续使用完整名称断言。

## 实现

1. 公开 URL fail closed
   - `server/utils/recipe/media-mapper.ts` 仍是全部公开 SourceSet 的唯一 URL 组装入口；
   - 所有公开对象必须是具有前后路径的 `web` 派生物，拒绝空段、URL、反斜杠、点段、重复 `web`、`original`、`processing` 与 `preview`；
   - 当 origin 为 `https://public-media.ditedog.com` 时进一步只接受 `prod/web/**`，其他环境前缀不能误投影到生产 ESA。
2. SSR/API 与配置边界
   - production verify 同时读取公开首页 SSR、首页聚合、作品、领养和返图 API，拒绝原始 OSS 域名、私有路径、`privateObjectKey` 与 `signedUrl`；
   - 生产媒体 URL 必须使用 `https://public-media.ditedog.com/prod/web/**`；
   - 单元测试递归扫描公开 route handler，禁止引入私有读/签名器、OSS 原站和 `x-oss`；运行时配置名禁止新增媒体/边缘/CDN 鉴权、签名 Key 或 TTL。
3. 生产依赖闭包
   - 首次 production build 暴露源码直接导入 `h3` 但未在根项目声明，pnpm 虚拟提升把开发工具链 H3 2.x 解析给源码，而 Nuxt/Nitro 仍使用 1.15.11；
   - 将实际运行时使用的 `h3@1.15.11` 声明为直接精确依赖，并同步 `/licenses`，不改变框架版本或请求行为；
   - frozen install 后根项目解析稳定为 H3 1.15.11，production build、typecheck 和完整单元测试通过。
4. 控制台与事实源
   - Handbook 明确 `public-media` 只回源网页衍生 Bucket，STS 由 ESA 托管，禁止以开放 ACL、自定义签名或混入私有对象规避失败；
   - 媒体事实源记录生产公开投影只允许 `prod/web/**`，真实原站 403、ESA 200 和 Bucket 双向清单仍由冻结 live preflight 在 T53 验证。

## 首次失败与处置

`APP_ENV=production pnpm build` 首次 **NOT PASS**：大量 route handler 同时出现 H3 1.x/2.x 的 `H3Event` 不兼容。依赖图确认 `server/utils/route/**` 直接导入 H3，但根项目没有直接依赖，虚拟提升目标来自 `@nuxt/eslint` 的开发工具链。补齐项目实际使用的 H3 1.15.11 后 frozen install 重放，根解析、production build、test-mode 冷构建和后续门禁全部通过。未删除测试、放宽类型或修改认证 handler。

## 实际门禁

| 命令 | 结果 |
| --- | --- |
| 相关文件 ESLint | PASS |
| `APP_ENV=test pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `APP_ENV=test pnpm test` | PASS，24 files / 143 tests |
| 定向 integration | PASS，3 files / 18 tests；公开站契约、展会投影、站点展示 reconcile |
| `APP_ENV=production pnpm build` 首次 | NOT PASS；H3 双版本类型解析，finding 保留 |
| `pnpm install --frozen-lockfile` 后 production build 重放 | PASS |
| `APP_ENV=production pnpm run verify:production` | PASS；health、公开 SSR、管理 CSR、四个公开 API、媒体泄漏与完整 `DITE DOG FURSUIT` 断言 |
| Playwright test-mode 冷构建 + 公开首页 SSR 定向用例 | PASS，1/1；完整 `DITE DOG FURSUIT` 断言通过 |

## Follow-up

- T52-E4 接入持久化业务下架 manifest、精确 ESA purge、任务收敛与恢复；E2 preflight 的一次性权限探针不替代业务状态机。
- T49 在 E1～E6 完成后的同一最新 SHA 重跑 frozen install、完整 integration/E2E、Actions 与独立 Review；本轮定向 E2E 通过不等于完整套件或远端全绿。
- T53-F2/F3 使用真实生产 Bucket/ESA/RAM 运行冻结 live preflight；任何原站非 403、ESA 非 200、Bucket 清单不一致或精确清理失败都停止部署。

本记录是实现者工程自测，不是独立 Review、用户验收或正式生产验收。
