# T15-F1～F4 用户预验收修正

> 日期：2026-08-13；基线：`8b52728`。
> 结论：PASS；T17 仍保留真实账号与物理手机扫码验收。

## 范围

- Hero 自动轮播不再因鼠标停留或控件聚焦隐式暂停；仍保留显式暂停、页面隐藏和 reduced-motion 门禁。
- 首页最近三条动态移动到“当前领养”之后、页脚之前，删除“工作室通知”，标题复用首页模块字号和标题基线。
- contact QR 输入扩展为 PNG、JPG/JPEG、WebP 与任意长宽比；服务端使用内嵌 FFmpeg Lanczos 将完整原图等比 contain 到 640×640 白色画布，再生成公开 320/640 PNG。
- 修复 `admin-home` 首屏设置用例和需求2双 Host 三视口总体验收用例。

没有修改 SMTP、动态富文本、作品发布语义、公开 Host 边界或水印规则，也没有重写历史迁移。

## 二维码媒体与迁移

- 新增前向迁移 `0032_requirement_2_contact_qr_upscale.sql`，只重建受 CHECK 影响的 `assets` 与 `upload_sessions`，保留旧数据、外键、跨表触发器和不可变身份触发器。
- 输入上限为 20 MB、每个维度至少 64 px；原图继续保存为私有对象且字节不变。
- 私有 `preprocess` 使用固定 `contact-qr-upscale-lanczos-v1` 身份；输出 640×640 PNG，白色补边、不裁切。
- 公开 `contact-qr-v1` 仍只投影整套 READY 的 320/640 无水印 PNG，不公开原图、预处理 Key 或签名 URL。
- FFmpeg 适配失败进入既有 PREPROCESS/DERIVATIVE 失败状态并可重试；后台显示处理阶段。

## E2E 首次失败与根因

1. `admin-home` 仍断言没有 READY 二维码的旧 QQ 会公开。修正为保存首页口号前后比较 contact 分区版本和数据，确认首页保存不改联系方式；公开页仍按完整渠道契约隐藏不完整 QQ。
2. 双 Host 三视口用例单独运行通过，但在全套件中会请求前序委托页大图的 `home-entry-commission` 公开变体。原因是总体验收只清理了首页轮播，随后又清空假媒体对象，留下了委托页数据库引用。修正为在清空假媒体前同时清理 home 与 commission 两种轮播，并重置公开目录、返图和联系渠道。
3. contact Card 保存两张渠道时，空字符串草稿与服务端 `null` 不相等，导致保存成功后仍被判定为 dirty。保存前统一规范化账号、邮箱和防诈骗文本，保存态恢复正常。

没有忽略 `console`/network 错误、删除用例或放宽状态码断言。

## 浏览器证据

- Edge 相关四个 spec 合并运行：47/47 通过。
- Edge 全量 E2E：239/239 通过。
- 三视口截图：`implementation/notes/t15/screenshots/home-latest-updates-*` 与 `public-two-channels-*`。
- 390×844 下两张渠道卡两列显示；768×1024 和 1440×900 下保持原栅格阅读宽度、左对齐且无横向溢出。
- 首页最新动态在三视口均位于当前领养后、页脚前，标题无眉题并与当前领养使用相同计算字号。

## 质量门禁

- `APP_ENV=test pnpm test`：179/179。
- `APP_ENV=test pnpm test:integration`：189/189。
- `APP_ENV=test pnpm lint`：通过。
- `APP_ENV=test pnpm typecheck`：通过。
- `APP_ENV=production pnpm build`：通过，含生产内容防泄漏守卫。
- `git diff --check`：通过。

首次未设置 `APP_ENV=test` 的 integration 运行按设计被测试专用缓存替身拒绝，导致 teardown 连锁失败；明确测试环境后全量通过，不属于应用缺陷。

## 后续

- 在本修正形成干净提交后，从新上下文执行 T16 独立 Review。
- T17 由用户使用真实平台账号和实际二维码完成视觉、业务与物理手机扫码验收。
