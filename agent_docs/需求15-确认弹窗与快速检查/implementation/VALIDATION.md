# 验证记录

日期：2026-10-11。使用当前本地分支、隔离数据库与合成媒体，不操作生产数据。

## 弹窗

- 扫描app下所有Vue/TS：原3处window.confirm已替换，无业务alert、prompt或Notification调用。作品/站点配置的beforeunload保留。
- 共用DiscardChangesDialog封装异步决定，内部使用既有AdminConfirmDialog；继续编辑默认聚焦、Escape取消、焦点循环与返回、销毁时取消等待。
- 两项新增Chrome smoke通过，覆盖作品与站点配置离开、语言切换、浏览器返回键、取消保留草稿、保存后无拦截、确认后继续、无原生confirm、无遗留滚动锁。
- 追加检查：语言确认打开时按返回键，只保留当前一个弹窗，避免叠加确认；两项复验通过。
- 1440px与390px截图已查看，位于忽略目录`.cache/discard-dialog-review/discard-1440.png`和`discard-390.png`。
- 既有多语言文案编辑回归通过（1项，含保存、取消语言切换、版本冲突和公开fallback）。截图改存testInfo输出目录，避免自动覆盖历史验收图片。

## fastcheck核对与实测

基线来源：[quality 37893280184](https://github.com/WangMinan/project-fur-forge/actions/runs/37893280184)，提交e24b069，2026-10-09。该次Fast checks为67秒，core为50.35秒；work-publication为34.538秒，runtime-api为26.780秒。只是既有远程数据，本轮没有触发Actions。

主要成本：低分辨率/长竖图测试使用高频彩色纹理，真实FFmpeg在PNG最高压缩上花费大量时间；Nuxt运行时夹具又重复执行了前一阶段已通过的类型检查。

| 同一组本地测试 | 优化前 | 优化后 |
| --- | --- | --- |
| work-publication，22项全部通过 | 49.55秒 | 17.56秒 |

该组减少约64.6%。报告原件保存在`.cache/fastcheck-media-before.json`和`.cache/fastcheck-media-after.json`，并复制到`.cache/discard-dialog-review/`。不把此比例当作整条CI流水线或远程实测收益。

- 原有默认160×64透明图的SHA-256保持`cf80f024e112ad3430da321ae9492888fb7364d00a7d7d877842b7aebc70202b`，默认调用字节不变；只是允许相关测试指定实际尺寸。
- 相关发布测试改用有边缘与透明度的棋盘，真实FFmpeg、Lanczos、PNG、长竖图尺寸、摘要、失败和原图留存断言均保留。其他源图与大文件边界测试不变。
- runtime-api夹具仍构建完整生产模式应用并执行18项真实HTTP测试，仅关闭夹具内重复typecheck；CI独立typecheck与产品build的typecheck继续执行。
- quality将原Fast checks展开为Lint、Typecheck、Core regression三步，顺序与本地check:fast一致；checks job标识、全部core发现范围、release流程和required checks未改变。

## 完整检查

- 全量lint、typecheck通过；补充弹窗防叠加后定向lint与typecheck再次通过。
- 69份core共354项通过，包括工作流契约、运行时认证/Host/CSRF、发布与撤销、恢复等检查。
- 本轮全量core与构建并行时用时207.80秒，仅作为完成记录，不能与单组隔离测量或GitHub耗时比较。
- 最终build和公开内容守卫通过；产物包含最终的防叠加分支。文档链接和git diff --check通过。

## 验证边界

未执行真实手机、独立Agent Review、远程CI、release/manual容器验证、镜像发布或生产部署。浏览器关闭/刷新时保留原生离开提醒，这是浏览器限制，不能用站内组件代替。

## 用户验收补修：长期运行的开发服务未解析新组件

2026-10-11 用户反馈：保存后再次修改物种，点击左上角“←作品”，仍留在页面但没有确认框。

- 现场只读检查localhost:3000返回的Vite编译代码：已有组件均被导入，新增DiscardChangesDialog却仍为`_resolveComponent("AdminDiscardChangesDialog")`，没有对应import。离开守卫已执行，但拿不到弹窗组件实例。前轮新启动的测试服务未覆盖这一长期开发服务状态。
- 用户确认已处理未保存草稿后，在作品页、站点配置页、文案语言编辑器3个调用位置显式导入组件。无需重启现有开发进程；再次检查同一3000服务，3处均已生成直接import，未再留下该动态解析调用。
- 回归用例改为“先保存→再次修改物种→点击左上角返回”，继续覆盖取消草稿、焦点、返回键和语言切换。
- Edge连接不可用，未操作或保存用户真实作品，也未代签原标签页的点击结果；现场证据来自开发服务实际返回的模块，交互证据使用隔离浏览器测试。
- 补修验证：定向lint、typecheck和2项Chrome回归通过（38.0秒）。本次仅显式导入调整，未重复全量core/build；前轮结果仍按其当时版本记录。

## 出包回归补修

2026-10-11，用户明确授权在main修复后重新出包。失败run为[38113580428](https://github.com/WangMinan/project-fur-forge/actions/runs/38113580428)，冻结SHA为246d4c1；lint、typecheck、354项core通过，浏览器51通过、2失败，镜像构建和发布未执行。

- main-journeys仍要求删除弹框包含已按用户要求删除的`dry-run`说明。改为断言不可撤销提示；原有脱敏计数、隐私不外泄、鉴权、确认、重复点击、执行中禁止关闭和失败重入检查全部保留。
- ui-controls仍要求已发布作品的内部用途禁用。按需求14改为验证可操作的下拉与选项展示，同时明确验证“选择照片”仍禁用；新作品领养状态的禁用占位选项检查保留。
- 定向eslint通过；`pnpm test:smoke tests/smoke/main-journeys.spec.ts:773 tests/smoke/ui-controls.spec.ts:9`两项通过（40.4秒）。只有测试/文档修改，没有更改业务、工作流、测试超时或发布门禁。
- 新出包以修复后的main SHA发起，最终发布状态与镜像digest以Actions记录为准，不以dispatch代签成功；不含生产部署。
