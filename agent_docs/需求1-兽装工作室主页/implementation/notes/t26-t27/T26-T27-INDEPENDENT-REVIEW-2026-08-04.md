# T26–T27 独立 Review（2026-08-04）

## 结论

待修复与复测后填写。以下“初始检查与 findings”形成于任何源码修改之前，后续仅追加处理结果，不删除或改写初始问题。

## Review 基线与范围

- 范围：T26 委托页与委托/领养营业状态；T27 关于、基本约定与联系页。
- 基线：`main` 与 `origin/main` 均为 `6c43f6181592d15b57de71100920de57c8ac47bb`，获取远端后工作区干净。
- 用户门禁：本轮明确为否；独立 Review 通过后可以勾选 T26/T27，用户仍可追加验收。
- 权威输入：已独立阅读 `CLAUDE.md`、`STATE.md`、foundation、SPEC、PLAN、models、TASKS、EXECUTION_ROUTING 及本轮后端/前端实施记录；实施记录只用于定位，不作为通过依据。

## 初始检查（修复前）

### 自动化与数据

- `pnpm db:migrate`：开发库 13 个迁移完整，新增 0，完整性检查通过；正式库当前 10 个固定文案字段均为空、两类营业状态均未创建，没有把 OQ-120 候选稿写入数据库。
- `pnpm lint`、`pnpm typecheck`：通过。
- 定向 unit：2 个文件、14 项通过。
- 定向 integration：认证/API、数据库、领域 Schema 共 3 个文件、30 项通过。
- 独立生产构建：通过；构建仍有仓库既有的 es2019/BigInt 警告，不属于 T26/T27 新增回归。

### 代码、契约与边界

- 固定字段、独立状态版本、管理端 Session/Origin/CSRF/Host 校验及 `no-store` 均存在；未建设通用 CMS。
- 公开 DTO 不含内容版本、状态版本、作品私有联系人、对象键或签名 URL；公开页联系方式来自 `site_content`。
- `localhost` 管理 API 匿名请求返回 401；`127.0.0.1` 请求管理 API 返回 404；管理 Host 请求公开 API 返回 404。
- `/commission`、`/about`、`/contact` 的正文由 SSR 输出；没有站内联系表单或模拟提交成功路径。

### 实际浏览器操作与观察

- 公开端使用全新匿名 Chrome 打开 `127.0.0.1:3000`：
  - 在 `/commission` 实际点击“复制邮箱”，页面显示“邮箱地址已复制到剪贴板”；`mailto:` 与 `/about#terms` 链接存在。
  - 真实横版与竖版 OSS 图片均成功解码；横版自然尺寸 `1440×810`，移动端竖版自然尺寸 `358×636`。
  - 在 `390×844`、`768×1024`、`1440×900` 检查委托页，均无横向溢出；`/about#terms` 锚点到达基本约定区；`/contact` 显示邮箱、QQ、抖音。
  - 公开接口 200 且 `no-store`；页面和接口中未发现 `version`、`ownerContact`、对象键或签名 URL。
- 管理端使用系统临时目录中的全新测试数据库和测试管理员：
  - 实际登录并分别把委托状态保存为“限量开放”、领养状态保存为“开放”；刷新后两者仍分别显示，数据库版本均为 1。
  - 在委托短说明输入 `<script>审查</script>`，界面显示“只允许安全纯文本，不能包含 HTML 或脚本”，保存按钮禁用。
  - 隔离生产进程在保存完整页面内容时返回 500，随后 CPU/内存异常增长并停止响应；已只停止确认属于本项目 3100 端口的进程。相同 service 输入和定向 integration 可成功写入，因此现阶段不把该隔离运行器故障伪装成业务通过，也不直接归因为产品缺陷。
  - 多会话冲突、页面内容保存后的公开投影与键盘完整复测因此未完成；用户已允许浏览器卡住时先推进，列入最终 follow-up。

## 初始 findings（冻结）

### must-fix

#### R26-01：公开页共享异步数据键发生运行时冲突

- 首页和委托页 console 均出现 Nuxt `NUXT_E3004`：`public-home` 使用了不同的 `transform` 配置。
- 根因是全局 `PublicFooter.vue` 与页面级调用同时使用 `key: 'public-home'`，但各自传入独立 `transform` 函数。
- 影响：开发运行时持续告警，Nuxt 不保证同键异步数据的选项兼容；全局页脚使问题影响多个公开页。

#### R26-02：公开固定文案包含未经用户确认的事实

- `/commission` 把全装描述为“覆盖头、身体、爪与尾巴的完整套装”，该组成来自尚未确认的 OQ-120 候选稿，不是已确认事实。
- `/contact` 写入“委托、领养与补全”，其中“补全”不在本轮确认业务范围。
- 影响：公开页面由 Agent 替用户声明业务事实，违反“候选文案不得宣布为正式内容”的门禁。

### should-fix

- 无。

### follow-up

#### F26-01：OQ-120 最终文案仍待用户确认

- 正式库保持空值是正确行为；本轮只验证固定字段、投影和交互，不自动录入候选稿。

#### F26-02：隔离后台浏览器剩余路径待人工补验

- 待复核：双上下文实际触发 409 后草稿保留/刷新基线/重试；完整页面内容保存后的 `/commission`、`/about#terms`、`/contact` 投影；后台及公开端键盘路径。
- 自动化与 service 级证据可继续作为工程 Review 依据，但不得把这些浏览器步骤写成已完成。

## 修复中补充 finding（第一轮修复后、第二轮修复前）

### should-fix

#### R27-03：公开端跳转链接未把键盘焦点交给主内容

- 在 `390×844` 的 `/commission` 从页面起点按 Tab，焦点正确到达“跳到主要内容”；按 Enter 后 URL 变为 `#main-content`，但活动元素回到 `BODY`。
- 根因是公开布局的 `#main-content` 不可编程聚焦；管理端 `#admin-main` 已使用 `tabindex="-1"`，公开端遗漏相同模式。
- 影响：键盘用户虽然能滚动到正文，但焦点顺序仍需从页首重新经过导航。

## 修复

- R26-01：把全局页脚的首页数据键改为 `public-footer-home`，避免与首页、委托页的页面级 `public-home` 调用共享不兼容选项。
- R26-02：全装只保留“完整兽装制作”；联系页删除“补全”及未经确认的 SEO 事实，未新增替代业务承诺。
- R27-03：按管理端既有模式，为公开 `#main-content` 增加 `tabindex="-1"`。
- 修复保持在 4 个 Vue 文件内，未新增依赖、抽象、数据库字段或配置项。

## 复测

### 自动化

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm exec vitest run --config vitest.config.ts tests/unit/site-content.test.ts tests/unit/site-content-presentation.test.ts`：2 个文件、14 项通过。
- `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/auth-api.test.ts tests/integration/database.test.ts tests/integration/domain-schema.test.ts`：3 个文件、30 项通过。
- `pnpm build`：通过，生产内容 guard 通过。
- integration 实际覆盖：固定内容成功写入、非法内容 400、缺 CSRF/错误 Origin 403、委托/领养独立版本、陈旧状态 409、公开投影刷新、版本和作品私有联系人不泄漏。

### 浏览器、视觉与运行时

- 在新的匿名 Chrome 会话依次访问首页、`/commission`、`/about#terms`、`/contact`；console 为 0 error / 0 warning，R26-01 的 `NUXT_E3004` 不再出现。
- `/commission`：
  - `1440×900` 请求真实横图并成功解码，自然尺寸 `1440×810`；`390×844` 请求真实竖图并成功解码，自然尺寸 `358×636`。
  - `390×844`、`768×1024`、`1440×900` 均无横向溢出；展示“完整兽装制作”，不再出现未经确认的全装组成。
  - `mailto:` 含“自设委托估价咨询”主题；复制按钮用键盘 Enter 触发并显示复制成功；页面没有 `form`。
- `/about#terms`：锚点保留，基本约定为空时如实显示尚未发布并引导官方渠道；邮箱、QQ、抖音来自公开投影。
- `/contact`：显示邮箱、QQ、抖音，不含“补全”，没有站内表单或模拟成功；防诈骗字段为空时整区隐藏，不生成占位事实。
- 键盘：首个 Tab 到达“跳到主要内容”，Enter 后焦点进入 `MAIN#main-content`；移动导航 Enter 打开后焦点进入关闭按钮，Escape 关闭并把焦点还给触发按钮。
- 视觉截图已人工查看，无裁切、遮挡或明显溢出：
  - `screenshots/independent-review-commission-390.png`
  - `screenshots/independent-review-commission-1440.png`
  - `screenshots/independent-review-about-768.png`
  - `screenshots/independent-review-contact-1440.png`

### 安全与公开边界

- 公开站点内容 API：200、`Cache-Control: no-store`，不含 `version`、`ownerContact`、`privateObjectKey`、`objectKey` 或 `signedUrl`。
- `/commission` SSR：200，正文和 `mailto:` 已直出，不含被删除的全装组成。
- 匿名管理 API 401；公开 Host 的管理 API 404；管理 Host 的公开 API 404；非法 Host 421。
- 从开发库抽取一项私有资产，仅输出匿名 HEAD 状态；私有 Bucket 返回 403，未输出对象键或签名 URL。

## Follow-up 与边界

- 浏览器隔离进程卡住前，已实际完成两类状态保存、刷新保留和非法输入拦截；双上下文 409 的弹窗草稿保留/刷新基线/重试，以及完整页面内容保存后的三页投影，未伪装为已完成。对应 API/service/integration 已通过，按用户授权转为下班后可选人工复核。
- OQ-120 最终文字及其余内容仍待用户确认；正式库继续为空，不因任务工程收口而自动写入候选稿。
- 本轮 USER_GATE 为否；用户明确允许 Review 通过后勾选 T26/T27，未完成的人工浏览器补验和 OQ-120 内容确认不再阻断两项工程任务状态。

## 最终结论

**PASS WITH FOLLOW-UP**。

3 个 finding 均已修复并复测通过。T26/T27 可以勾选；follow-up 仅保留后台隔离浏览器的可选人工复核与 OQ-120 正式文字确认，不改变当前空值投影和“不编造事实”的通过结论。
