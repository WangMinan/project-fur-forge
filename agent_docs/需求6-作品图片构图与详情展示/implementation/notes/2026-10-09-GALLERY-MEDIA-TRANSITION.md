# 作品详情复用首页媒体切换动效

2026-10-09 用户授权直接在 main 落实：移动端作品详情已有左右滑动，本轮复用首页的切换淡入淡出。

## 实现

- 将首页代表作品与当前领养重复的方向性交叉淡化提取到 `public-base.css` 的 `public-media-next/prev`，三处共用，首页既有参数不变。
- 详情从原 180ms opacity 切换改用同一套 420ms opacity、`--motion-duration-media` transform、`--motion-ease-standard` 曲线与 42px / 0.99 轻移缩放；新旧图片同时过渡，舞台本身不移动。
- 滑动保留手势方向，包括首尾循环；缩略图点击/键盘激活按目标索引方向切换。选择当前图片不触发动画。
- Vue Transition 处理连续改选；保留 SSR 首图、完整显示、单图布局、竖向滚动、缩略图自动露出和减少动态模式。

## 验证与复跑

- `pnpm test:media tests/smoke/work-gallery-motion.spec.ts`：Chrome/WebKit 各覆盖 402px、1440px。验证实际中间帧两层 opacity、相反位移方向、正反向及首尾循环、键盘选择、连续改选后的单图终态、减少动态及 console/溢出。
- 首次 Chrome 手机用例在图库挂载前发送合成手势；已复用已有测试的组件挂载等待，重跑通过。WebKit 两项及 Chrome 修正后两项均通过。
- 真实触屏事件由现有 main-journeys 的 Chrome CDP 用例覆盖；新增动效用例使用合成 PointerEvent，便于在 WebKit 下执行同一逻辑，不能代签实机手势手感。
- 相关共享样式回归8项通过，涵盖首页滑动、领养滑动、七张详情图横竖屏、触控导航，以及此前图片完整显示矩阵。
- 核心测试：carousel-controls、carousel-playback、public-sources 共7项通过；lint、typecheck、production build及内容守卫通过。
- 动画中间帧已在 Chrome/WebKit 合成媒体截图中检查；真实 iPhone Safari 与真实图片加载网络条件仍需人工验收。

本轮仅本地 main 提交，未推送、镜像发布或生产部署；未改变 required checks。
