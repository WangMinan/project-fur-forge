# T26-F1 / T27-F1 独立 Review（2026-08-05）

## 结论

**PASS WITH FOLLOW-UP**。新上下文 Review 先在 `c7756b058ab42174cdc1ce1adee2277ad6c6e4a5` 冻结初始 `FAIL / CHANGES REQUESTED`，再对修复后的未提交快照独立复核。7 个 finding 全部关闭；真实 OSS 新写入与用户验收仍是独立门禁，T26-F1、T27-F1 保持未勾选。

## 初始 findings（修复前冻结）

### must-fix

1. 低分辨率 FFmpeg 适配同步占用 HTTP 请求，只在浏览器保存 `upscaling` 状态；没有操作 ID、查询、持久失败或刷新恢复。
2. `foundation/README.md` 与 `.design/public-site/DESIGN_BRIEF.md` 仍写委托页复用首页图，与现行独立集合、零张不回退契约冲突。
3. 0015 已把站点内容版本推进到 3，但集成测试仍断言 2。

### should-fix

4. 低分辨率风险只在未启用时显示，启用后消失。
5. 移动菜单声明 `aria-modal`，但 Tab 可离开对话框，背景也未 inert。
6. 移动菜单把“关于我们”父链接与同地址子链接同时显示。

### 修复复核中新增 must-fix

7. 首页管理 E2E 仍要求页脚显示邮箱与 QQ，和 T27-F1“联系合并进关于页、页脚不重复”契约冲突。

## 修复

- 复用 `publication_operations` 增加 `UPSCALE / PREPARING_SOURCE`，沿用现有查询、轮询与反馈通道；0016 扩展约束，新增受保护 retry API。适配失败持久化，刷新恢复后可以继续重试；成功后沿原发布链启用。
- 低分辨率卡片始终显示原尺寸、推荐尺寸与“不恢复细节”风险；适配源完成后仍保留说明。
- 校准两处委托图片来源文档与 0015 版本断言。
- 移动菜单复用原结构增加首尾 Tab 环和背景 inert，并直接显示三个“关于我们”子入口。
- E2E 改为在 `/about#contact` 验证更新后的邮箱/QQ，同时断言页脚不重复联系方式。

## 独立复测证据

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 针对性 integration：3 个文件、20/20 通过。
- 低分辨率浏览器链：取消无副作用；强制失败后刷新仍显示失败；恢复存储后重试适配并自动启用；私有适配源完成且风险说明持续显示。
- 移动菜单：`main`、`footer` 为 inert；正向/反向 Tab 均留在 dialog；Escape 关闭后回焦；移动菜单 `/about` 只出现一次；console 0 error / 0 warning。
- T27-F1 法律页、301、三视口状态框既有定向浏览器用例继续通过。
- 修正后的联系投影 E2E：1/1 通过；`git diff --check` 通过。

## 已确认边界

- 独立 Review 未在真实 Bucket 新写入低分辨率适配对象，因为没有为本轮声明独立安全前缀；实现使用隔离 Fake OSS 覆盖成功、取消、失败、刷新与重试。既有真实私有 Bucket 匿名读取 403 和公开委托图读取 200 证据继续有效。
- Review 不能代替用户视觉与文案验收；两项任务只更新为“独立 Review 已通过”，不勾选。
- 初始 FAIL findings 保留，不以最终结论覆盖审查历史。
