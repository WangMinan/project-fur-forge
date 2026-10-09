# 首页领养图片移动端截断修复

## 范围与原因

2026-10-09 用户授权直接在 main 修复，并补充防止桌面正常、移动端缩放异常的检查。本次不包含推送、镜像发布或生产部署。

首页领养媒体的内层 Grid 使用隐式 auto 行，图片固有高度可以撑大 picture；手机短屏画框受 `32svh` / `31svh` 限制，外层 overflow 隐藏了超出的底部。`object-fit: contain` 只约束图片自身盒子，不能阻止该盒子被祖先裁切。修复前的浏览器回归捕获到图片高 192.75px、内层画框高 165.75px。

仅在 `HomeCurrentAdoptions.vue` 的 media-surface 增加 `grid-template-rows: minmax(0, 1fr)`，让内部图片随画框缩小。保留画框尺寸、断点、完整显示模式和轮播布局。

## 回归防护

- `tests/smoke/public-image-containment.spec.ts` 随现有 smoke 收集；断言解码后的图片位于每层父容器的内容区内，而非仅检查页面无横向溢出或 object-fit 属性。
- 使用 2400×1667 横图、2400×4800 竖图、2400×2400 方图。通用媒体 fake 的实际像素比例固定，因此仅在本用例中按公开 sources 的尺寸返回带四边框与底边标记的合成 SVG，避免元数据与真实像素不一致。
- 首页覆盖单图、多图选择、普通/减少动态及 hover 终态；视口覆盖 320×568、402×680、390×844、667×375、767×600、768×1024、1024×768、1025×600、1440×900，连续 resize 覆盖旋转及断点切换。
- 领养目录使用相同九档视口和三种比例，详情单图检查短屏、横屏与桌面。检查了其他 ResponsivePicture 调用方；本次没有证据支持修改它们。
- 新增 `pnpm test:media`，在 Chrome 与 WebKit 下运行同一组用例；不改变现有 required checks。首次使用需安装对应运行时：`pnpm exec playwright install webkit`，Chrome 沿用现有本机安装。

后续修改完整显示的媒体布局时，应同时变化视口宽度与高度，并检查真实解码比例、嵌套 Grid/Flex 的最小尺寸及实际裁切边界；不能以单一 390×844 模拟或 object-fit: contain 文本断言代替布局验收。

## 验证

- Chrome：图片完整性 3 项通过；原有斜向触屏切换与轻点导航 1 项通过。
- WebKit：同一组图片完整性 3 项通过（`pnpm test:media --project=webkit`）。
- lint、typecheck、相关 core 5 文件 / 18 项、production build 与内容守卫通过。
- 已检查 Chrome 与 WebKit 合成图截图，四边与底边标记完整。
- 未执行真实 iPhone/Android 验收、独立 Review、远程 CI、镜像发布和生产部署；Windows WebKit 不能代签真实 iOS Safari。
