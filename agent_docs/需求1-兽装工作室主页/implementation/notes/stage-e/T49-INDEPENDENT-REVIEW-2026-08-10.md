# T49 独立综合 Review 记录

> 日期：2026-08-10  
> 结论：**PASS**  
> 最终实现 SHA：`e804c132ffbdc846ae6ec4a1df17b646af826d5d`  
> 最终实现质量 run：[`31369781771`](https://github.com/WangMinan/project-fur-forge/actions/runs/31369781771)

## 结论与授权边界

T49 在保留全部历史 NOT PASS、关闭本轮发现并完成本地与同 SHA 远端门禁后记为 PASS，可以进入 T50。

最后一个全新独立 Review 上下文完整复核到 `a63c65a7bb83b4337eb0a19fb4463477d7dd5596`，并发现 Handbook 管理登录测量目标错误这一项 MEDIUM。该 finding 随后由当前实现上下文在 `e804c13` 关闭。用户在 2026-08-10 当前 T49 交互中明确授权：这是最后一轮独立 Review；最终 finding 修复、回归与同 SHA CI 成功后不再拉起新的 reviewer，可以关闭 T49。本记录如实保留这项授权例外，不把 `e804c13` 冒充为另一次 fresh independent Review。

T49 PASS 只允许开始 T50，不代表 T50、GATE-E、T53 或正式发布已完成；也不关闭 T46 用户隐私文案确认和 T51 正式素材选择。

## 最终实现 SHA 的同一流水线证据

| Job | Job ID | 结果 |
| --- | ---: | --- |
| `checks` | `93395957194` | success |
| `image-build` | `93395957130` | success |
| `e2e` | `93397202913` | success |

用户在当前交互中提供 run 页面截图，显示三个 job 全绿；截图展开的 `e2e` job 中 setup、checkout、pnpm、Node、Chromium、Run E2E、artifact 上传和 post step 均成功。GitHub API 查询期间曾间歇出现 TLS timeout/EOF，但已取得正确 run、SHA 与 job ID，用户提供的同一 run 页面作为终态补充证据。

`image-build` 在 Linux runner 中实际覆盖生产镜像、app-only Compose、一次性 migrate/init/preflight/health/backup/restore/recover/rollback，以及 Nginx 1.30.4 HTTP-only 配置、reload 和 Host 行为。本机没有 Docker/Nginx CLI，因此没有把本地静态检查冒充容器动态证据。

## 本地与独立门禁

最终修复 `e804c13`：

- frozen install：此前同一连续 T49 工作链 PASS；
- lint：PASS；
- typecheck：PASS；
- unit：30 files / 166 tests PASS；
- integration：20 files / 172 tests PASS；
- `APP_ENV=production pnpm build`：PASS；
- production output verify：PASS；
- Secret scan：484 tracked files clean；
- ESA cache policy：PASS；
- security/observability policy：PASS；
- ops bundle：PASS；
- `git diff --check`：PASS。

最后一个独立 Review SHA `a63c65a`：

- frozen install、lint、typecheck、unit 165、integration 172、production build/verify、Secret、ESA、observability、ops 与 OSS preflight dry-run 均 PASS；
- 完整 Playwright：221/221 PASS，单 worker，427.2 秒；
- 最终 `e804c13` 又由同 SHA 远端 `e2e` 成功覆盖最后一项 measurement/Handbook 修复后的回归。

## Review 轮次与 findings 闭环

| 轮次 / SHA | 当时结论 | Finding | 关闭方式 |
| --- | --- | --- | --- |
| 初始 `018b12b` | NOT PASS | HIGH：Handbook 只替换 public/admin，遗漏 Nginx 模板 `@@MEDIA_HOST@@` | `d895052` 增加第三 Host、完整替换集合与 deployment-contract 回归 |
| fresh `d895052` | NOT PASS | HIGH：production runtime/preflight 接受任意 HTTPS `MEDIA_BASE_URL` | `702db55` 精确限制为 `https://public-media.ditedog.com`，增加攻击者域名负向测试 |
| fresh `702db55` | NOT PASS | MEDIUM：`/returns` 使用全站十分钟 seed，不符合每次请求随机；LOW：Handbook T52 状态漂移 | `ab61d9d` 改为每次无 seed 请求生成 128-bit seed，分页显式保留；同步 Handbook 状态 |
| fresh `ab61d9d` | NOT PASS | HIGH：ESA purge 失败后仍可永久删除实体并孤立 manifest；MEDIUM：WAF analytics 路径错误；LOW：返图注释漂移 | `54fd22c` 统一阻止未收敛 cleanup 的作品/返图/Hero 删除，重试 COMPLETE 后放行；WAF 对齐真实 API；同步注释 |
| fresh `54fd22c` | NOT PASS | MEDIUM：返图 PUBLISH cleanup retry 会误把未发布实体的 operation 标为 DONE | `a63c65a` 区分 PUBLISH/UNPUBLISH；PUBLISH 清理成功后保持 FAILED，并增加真实生成、提交失败、首次删除失败、重试回归 |
| final fresh `a63c65a` | NOT PASS | MEDIUM：Handbook 测量 `/login`，真实为 `/admin/login`；measurement 对 404 仍 exit 0 | `e804c13` 修正文档；measurement 对非 2xx 或非精确 HTTP→HTTPS redirect 写证据后 fail closed；增加单测 |

没有删除测试，也没有放宽类型、安全、媒体、隐私、Host、运行时或部署断言。各轮 NOT PASS 均保留，没有被后续绿灯覆盖。

## 历史 Actions 失败根因复核

- T46/T51 早期链包含：Secret fixture 被扫描、Compose 缺备案/ESA 配置、品牌与阶段 D/E fixture/断言尚未同步；修复均通过更新受控 fixture/配置/真实契约完成，没有放宽扫描器或 Schema。
- `332744a` / `31325728593`：integration 缺四个互异测试 origin；image dry preflight 正确拒绝占位 production config；E2E skipped。
- `47211e9` / `31326347449`：容器 health probe 未携带允许的公开 Host，被 Host isolation 返回 421。
- `9353864` / `31326725491`：恢复数据库使用 `/app/data/ci-restored.db`，而 runtime 当时硬编码 `studio.db`。
- `4582c85` / `31327226267`：三条 E2E 仍断言旧 FFmpeg、ESA cleanup 与 Analytics 文案。
- `3e99f74` / `31328323057` 首次取得当时 SHA 的三 job 成功；`fcb99f4` / `31329958587` 再次成功，关闭 T52-E6 工程自动化，但不代签 T49。
- 后续每个 finding 修复 SHA 都重新取得自己的质量流水线；最终以 `e804c13` / `31369781771` 为准。被新 push 取代而 cancelled 的 run 未计为成功。

## 进入 T50 前仍保持开放的门禁

- T50 全站、媒体、进程、部署和恢复最终回归尚未开始；
- GATE-E 尚未冻结唯一上线 SHA/镜像；
- T53 真实生产值、控制台配置、部署、warm-cache purge 时长、监控阈值和恢复演练尚未执行；
- T46 用户隐私文案确认与 T51 正式素材选择仍由用户关闭。

因此本记录的唯一交接结论是：**T49 PASS，允许进入 T50；不得宣称正式上线就绪。**
