# 验证记录：在线文本维护

日期：2026-10-11。全部使用本地隔离数据库、合成图片与模拟存储。

## 自动检查

- `pnpm check:fast`：lint、typecheck、69个core文件共354项通过。
- 定向work-management、work-publication、r3-hero-collection-publication共45项通过，随后纳入全量core复验。
- 在线文字保存前后逐项比较资产、派生记录、发布时间、发布任务及公开图片地址；没有新增媒体处理或删除。验证旧版本拒绝、说明字段白名单、不属于当前作品的图片拒绝、事务回滚、发布中禁止编辑，以及原媒体修改限制。
- 浏览器最终批次：online-content-editing、hero-workspace、hero-focal共7项通过。另一次single-work-image回归通过，覆盖未发布状态单图编辑、失败草稿与上传保存。
- 首轮浏览器发现旧Hero断言仍读取只读段落，已改为核验编辑框值；新增保存反馈在无历史发布任务时不可见，已补齐就近status并复验。
- 最后两处Hero反馈/样式调整后，定向lint与全量typecheck再次通过。
- 构建与公开内容守卫：最终结果见STATE。
- README本地链接检查16处通过；`git diff --check`通过。

## 浏览器与视觉

- 作品：已发布状态下保存角色名、画师、价格和三类图片说明；500失败保留输入；真实版本冲突保留草稿；刷新还原；公开API正确读取；图片移除与上传按钮仍禁用。
- Hero：首页唯一启用图只提交`alt`，公开资源地址保持；键盘保存；真实版本冲突保留输入，主动放弃并刷新后才读取远端说明。
- 1440px与390px截图已查看；既有Hero工作区覆盖320/390/768/1024/1440px、键盘与减少动态/增强对比偏好。图片decode通过、无页面横向溢出、无pageerror。Hero焦点测试覆盖四集合及原发布/适配保存顺序。
- 截图保存在忽略目录 `.cache/online-text-review/`：`work-1440.png`、`work-390.png`、`hero-1440.png`、`hero-390.png`。图片为测试图，不作为真实摄影效果展示。

## 未执行

未运行生产OSS/ESA验证、真实手机验收、独立Agent Review、远程CI、镜像发布或生产部署；未修改生产数据。README未在GitHub线上渲染验收。
