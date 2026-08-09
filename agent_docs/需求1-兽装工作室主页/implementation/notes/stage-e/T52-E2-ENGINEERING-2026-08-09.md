# T52-E2 工程记录 · OSS/ESA 生产预检

- 日期：2026-08-09
- 基线 commit：`e18caf28f9a30ed008e2816f2ee43905a7e30f82`
- 角色：阶段 E 实现者自测
- 结论：**PASS WITH FOLLOW-UP**

## 范围与边界

本轮把旧的 public-read OSS preflight 重写为可冻结、可在阶段 F 直接运行的 OSS/ESA 生产预检：默认 dry-run 只验证本地 production 契约，只有显式 `--no-dry-run` 才访问云侧并写入本次 run 的精确测试对象。

阶段 E 没有填写或使用真实生产 Secret，也没有修改 Bucket ACL/BPA、ESA DNS、套餐、证书或有效 Site 配置；因此本记录不声称真实 Bucket/ESA 已通过。T49 独立 Review、T53 目标环境 live 运行与用户验收仍开放。

用户再次明确英文品牌必须保持 `DITE DOG FURSUIT`。实现常量与页面代码未改；仅把 E2E 和 production verify 中过宽的 `DITE DOG` 子串断言收紧为完整名称。

## 实现

1. `scripts/oss-preflight.mjs` 与 `production-preflight-core.mjs`
   - 固定杭州 ECS 内网服务端 Endpoint、私有 Bucket 公网上传 origin、`public-media` ESA origin、两只既有 Bucket 与独立 OSS/ESA RAM 凭据；
   - dry-run 不发网络请求、不写云资源，输出计划检查；live 才执行读/写门禁；
   - 检查 Bucket identity/region、private+BPA、Policy Status、Object ACL、精确 CORS、生命周期和完整对象清单；
   - 网页衍生 Bucket 与生产数据库 `READY + PUBLIC` 变体双向绑定，拒绝未跟踪、缺失和非 `prod/web/` 对象；
   - 用精确 run 前缀验证条件 PUT、禁止覆盖、错误 Origin、篡改 MD5、过期签名、越权 Key、应用 HEAD/GET、OSS 图片处理、跨 Bucket 保存与精确清理；
   - 两只原始 OSS 域名匿名 GET/HEAD 必须为 403；ESA 衍生 URL 必须为 200，且响应地址/头不暴露 OSS 原站或私有 Key；
   - 使用阿里云官方 `@alicloud/esa20240910` SDK 执行精确 `PurgeCaches(Type=file)`，保存脱敏 TaskId 并用 `DescribePurgeTasks` 收敛；`ListSites` 和无效 `SiteId=0` 的删除负向探针必须权限拒绝；
   - 证据只记录状态、稳定 reason、计数、HTTP 状态、指纹和脱敏 ID，不记录 Secret、对象 Key 或签名 URL；失败非零退出，read-only 边界失败时不进入 live 写入阶段。
2. 生产依赖与镜像
   - 新增官方 ESA SDK `3.13.0`；直接 Apache-2.0 依赖已同步 `/licenses`；
   - 审查并允许 `@alicloud/openapi-core` 的版本选择 postinstall；Node 24 路径不下载二进制；
   - 用 override 把 ESA 凭据链的 `ini` 固定到 `1.3.8`，消除本次新增的已知漏洞；`pnpm audit --prod` 仍报告 4 项 Nuxt 依赖链 high，未伪称零漏洞；
   - Dockerfile 复制新 preflight core，并在 runtime 自检中同时 import OSS/ESA SDK；`pnpm deploy --prod` 临时最小闭包已实际 import OSS、ESA、SQLite、FFmpeg 后精确清理。
3. 文档与命令
   - 同步 OSS preflight 契约、部署说明和 Handbook；目标环境固定先 dry-run，再显式 live；
   - pnpm 11.18 下使用 `pnpm run verify:production`，避免 `pnpm verify:production` 被解析为 pnpm 自身命令并错误裁剪开发依赖。

## 首次失败与处置

1. 首次安装官方 SDK 被 strict dependency build policy 拦截；审查 `@alicloud/openapi-core` postinstall 后只为该包增加 `allowBuilds`，frozen install 重放通过。
2. 首次 production audit 比最终结果多出 ESA 凭据链的 `ini` high；固定到 `1.3.8` 后该新增项消失，剩余 4 项全部位于 Nuxt 依赖链。
3. `pnpm verify:production` 被 pnpm 11.18 解析为自身 `verify`，执行 production install 后因缺少 `@nuxt/eslint` 失败；立即用 `pnpm install --frozen-lockfile` 恢复可再生依赖，再以 `pnpm run verify:production` 重放通过，并修正当前命令入口。
4. 完整 test-mode E2E 冷构建仍触发仓库已知的 H3 1.x/2.x 类型冲突，测试服务器未启动、断言未执行；该基线问题按既定范围留给 T49。为验证本轮品牌测试，复用既有 E2E 产物运行公开首页 SSR 用例，1/1 通过；当前 production 构建的 SSR verify 也通过完整英文品牌断言。
5. 当前工作机没有 Docker CLI，不能执行本地镜像构建；已用 Dockerfile 同源的 `pnpm deploy --prod` 最小闭包验证替代。本结果不冒充 Docker/Actions image-build，最终镜像仍由 T49 验证。

## 实际门禁

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | PASS |
| `APP_ENV=test pnpm typecheck` | PASS |
| `APP_ENV=test pnpm test` | PASS，24 files / 141 tests |
| `APP_ENV=production pnpm build` | PASS |
| `pnpm run verify:production` | PASS，health、公开 SSR、管理 CSR；完整 `DITE DOG FURSUIT` 断言通过 |
| `pnpm run ops:build` | PASS |
| `pnpm deploy --prod` 临时闭包 + runtime imports | PASS；临时目录已精确删除 |
| `pnpm run preflight:oss` 合成配置 dry-run | PASS；无网络/云写入，证据已精确删除 |
| Playwright 公开首页 SSR 定向用例 | PASS，1/1；复用既有 E2E 产物 |
| 完整 test-mode E2E 冷构建 | NOT RUN；已知 H3 双版本构建错误，留待 T49 |
| `pnpm audit --prod --registry=https://registry.npmjs.org` | 4 high，均在 Nuxt 依赖链；本轮新增 `ini` 项已消除 |

## Follow-up

- T52-E3/E4 继续收敛所有公开 SourceSet/DTO 和持久化 purge operation；preflight 的一次性 purge 只验证凭据/协议，不替代业务撤销状态机。
- T52-E6/T49 在可用 Docker/Actions 环境完成真实最小镜像、Compose 与 image-build；T49 同时关闭 test-mode E2E/H3 基线。
- T53-F2/F3 在用户完成真实 Bucket/ESA/RAM 收敛后运行 frozen live preflight，任何 FAIL、blocked 或精确清理失败都停止部署。

本记录是实现者工程自测，不是独立 Review 或正式生产验收。
