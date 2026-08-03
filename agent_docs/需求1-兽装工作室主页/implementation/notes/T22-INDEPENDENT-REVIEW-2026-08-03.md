# T22 独立 Review

> 日期：2026-08-03  
> REVIEW_SCOPE：T22 完整作品字段与约束  
> USER_GATE：是  
> 候选基线：`7e86bc58b92c836d2e1b10ef52133e82097ff1cb`  
> 规则：本节“初始 findings”固化后不可改写或删除；修复、复测与最终结论只允许追加。

## 初始 findings（代码修改前）

### must-fix

- 暂无。仍需以真实管理/公开 Host 浏览器操作、网络与 console、三视口、并发冲突、非法字段矩阵和图片解码完成动态核验；自动化通过不构成 PASS。

### should-fix

- `T22-FRONTEND-2026-08-03.md` 的“浏览器操作记录”仍写既有已发布作品排序/精选控件为禁用，与候选代码中已改为通过独立 presentation 接口直接维护的当前行为不一致。实施记录是历史材料，不改写；本 Review 将以实际浏览器结果追加澄清。

### follow-up

- 常规领养发布仍由 T25 的 `ADOPTION_FLOW_NOT_READY` 阻断。T22 Review 可真实创建、编辑、重载领养草稿并验证公开 mapper/页面夹具，但不能把管理端发布领养作品或通过该路径进入公开站写成已通过。
- T22 保持 `[ ]`；即使最终 Review 为 PASS，也等待用户实际管理体验验收。

## 初始契约摘要

- 三用途共享写入联合类型：`commission | adoption | showcase`；非领养严格拒绝领养字段，领养只写 `regular` 与五个非展会状态。
- `ownerDisplay` 去空白后必须非空；`ownerContact` 只允许出现在认证管理 DTO 的 `private` 投影。
- 短属性 0–8 条、逐条 1–24 Unicode 字符、同作品去空白后唯一且保序；价格为空或正整数分，币种固定 CNY；排序为非负整数。
- 完整事实修改要求下架并携带资源版本；presentation 修改允许已发布作品，仍要求版本，重复精选顺位由服务端选择下一空闲非负顺位。
- 公开列表/详情只读取已发布且活动水印 variant 完整的记录；精选按人工顺序最多 6 项，0 项不渲染轨道；公开投影不得泄漏联系人或私有媒体信息。

## 动态核验追加 findings

### should-fix · T22 E2E 未按真实模态交互恢复

`tests/e2e/admin-works.spec.ts` 首轮单 worker、全 trace 运行得到 23/26 通过；3 项失败都停在同一根因：应用在校验或服务端失败后按设计打开 `role="alertdialog"` 的“保存未完成”模态框，测试断言提示后没有点击“知道了”，随后直接操作被 overlay 正确拦截并超时。真实用户必须先确认模态框才能回到表单；测试需要补上该真实恢复动作，不能用强制点击绕过。

## 修复与复测

- 只修改 `tests/e2e/admin-works.spec.ts`：失败路径在断言可见错误后真实点击“知道了”，再继续修正输入或重试；400 文案断言对齐页面实际显示的“未通过服务端校验”。未修改生产代码、Schema、数据库或 API。
- 原始失败 trace 保存在首轮 `test-results/.../trace.zip`；修复后先定向复跑 3 项得到 2 通过、1 项精确文案断言失败，再单独复跑 400/500 恢复路径 1/1 通过。
- 最终完整 `admin-works.spec.ts`：26/26 通过。实际路径包含：匿名访问回登录；创建 commission/showcase/regular adoption；必填与非法 slug；价格 0/负数/三位小数；短属性重复/空白/超长/排序；用途切换隐藏字段不提交；列表与内层 presentation；两个页面陈旧版本 409；历史展会显式转常规；400/500 失败、确认、恢复；公开预览泄漏守卫；no-store/noindex；三视口、键盘、焦点、reduced-motion、console/network。
- 公开端定向浏览器：三视口真实图片解码与无横向溢出 2/2 通过；首页精选有数据顺序和 0 项整区隐藏 2/2 通过；详情 HTML/API 不含联系人、私有 Key、签名 URL 或草稿对象 1/1 通过。
- 三视口证据已另存至 `implementation/notes/t22-independent-review/screenshots/`，没有覆盖 T14–T20 的历史截图；Playwright trace 保存在本地 `test-results/`。

## 自动化结果

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | 通过 |
| `pnpm typecheck` | 通过 |
| T22 unit（work-form/price/work-presentation/contracts） | 4 文件，37 项通过 |
| T22 integration（database/domain/work-management/publication/public-site/auth-api） | 6 文件，50 项通过 |
| `admin-works.spec.ts` | 首轮 23/26；修复测试恢复动作后最终 26/26 通过 |
| 公开三视口解码/溢出 | 2/2 通过 |
| 首页精选顺序/空态 | 2/2 通过 |
| 公开详情泄漏守卫 | 1/1 通过 |
| `pnpm build` | 通过，production content guard 通过 |

## 浏览器观察

- 管理 Host 使用 `http://localhost`，公开 Host 使用 `http://127.0.0.1`；测试服务分别执行真实 Session、Host/Origin 边界，没有混用访问面。
- commission 请求不含任何领养键；showcase 的排序/精选重载后保留；regular adoption 将元精确换算为分，发布区明确显示 T25 尚未开放。
- 失败保存会打开有焦点的 `alertdialog`，点击“知道了”后返回保留输入的表单；版本冲突使用“重新加载（放弃本地更改）”恢复，再次保存成功。
- 已发布作品可从列表或内层页面修改 presentation；重复精选顺位由服务端避让，公开首页随即按新顺序显示。
- 公开首页 0 项不出现空精选轨道；有数据时只显示最多 6 项。列表、详情与首页图片在 390×844、768×1024、1440×900 均完成解码，无横向溢出。
- console 未出现 T22 页面运行错误；可见的 `/commission`、`/adoptions`、`/returns`、`/about`、`/contact` 未匹配警告属于 T26–T29 尚未实现路由，登记为 follow-up，不阻断 T22。

## 最终结论

**PASS WITH FOLLOW-UP**

- T22 范围内 must-fix = 0；should-fix 的 E2E 恢复路径已修复并全量复测。
- follow-up：常规领养真实发布仍归 T25；缺失的公开导航目的页归 T26–T29；这些边界没有被本 Review 伪装为 T22 已完成。
- T22 仍保持 `[ ]`，等待用户实际管理体验验收；本 Review 不代替 USER_GATE，也不授权进入 T23。
