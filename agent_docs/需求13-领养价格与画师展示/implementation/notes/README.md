# 实施备注

## 用户验收补修

- 2026-10-09：用户确认Safari图标探测404的诊断后授权补齐资源。新增public/apple-touch-icon.png与public/apple-touch-icon-precomposed.png，均直接复制public/brand/apple-touch-icon.png；generate-brand-assets.mjs在原图生成后同步复制。node语法检查、定向eslint及本地HTTP/180×180/响应字节一致性检查通过；不新增页面路由、不屏蔽警告，未执行完整品牌重生成、全套测试或生产发布。
- 2026-10-09：用户指出管理预览价格行错位及物种圆点多余。确认上轮插入画师行时价格div遗漏preview-card__fact，导致价格dt/dd回到默认样式；补回共用类。AdoptionCard删除物种::before规则，同时作用于横卡和竖卡。仅样式修复，数据库及展示条件不变。lint/typecheck、15项相关unit及2项Chrome通过，新增390/1440px管理预览截图，并更新公开卡片截图。实现者查看确认价格字体/列对齐、横竖卡无物种前导圆点；未重复build或发布检查。

- 2026-10-09：从本地main 3bd6062创建codex/r13-adoption-price-artist，origin/main为c8c0bd6；两条已有本地提交保留。
- 原需求7价格禁用断言需要局部更新，首页与列表断言继续保留。
- 待记录验证结果与0057迁移交接；本轮不操作生产。

- 2026-10-09：lint、typecheck、build（含生产内容guard）通过；10份受影响core共101项通过。首次失败仅为旧adoption详情对象缺少priceCnyMinor预期及旧迁移列清单缺少artist，修正后定向复验通过。
- Chrome管理端署名保存/预览/刷新/清空通过；需求7两项i18n回归通过。新公开用例首轮main/保存按钮定位错误已修正；第二轮首个fixture POST超时，服务health和公开API仍200，其余三项通过，公开用例单独复验通过。
- 开发库现场核对development与仓库内路径后，迁移0056+0057，自动备份已创建，integrity=ok、外键异常=0；不操作生产。

- 最终Chrome复验：新增公开与管理两项一起通过；公开含四种填写组合、已领养金额、中文/英文SSR、320–1440px、200%文字缩放、长姓名/署名、decode、键盘、触屏、reduced-motion、来源及图片保留。此前截图补验发现测试直接改Cookie可能抢在上一页水合前执行，已明确等待Vue挂载；最终无水合/控制台错误。截图关闭有限时长动画，12张产物已抽查。
- 需求7两项回归通过；其测试生成的四张历史截图已恢复，避免混入本次改动。需求13共20处相对文档/截图链接及git diff空白检查通过。
