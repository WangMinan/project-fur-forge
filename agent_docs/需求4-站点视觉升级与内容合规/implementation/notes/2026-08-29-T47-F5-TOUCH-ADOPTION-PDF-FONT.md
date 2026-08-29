# T47-F5 Handoff · Touch / Adoption Detail / PDF Font & Progress

## Completed

- Homepage Hero 与 Featured Works 在整幕设置 `touch-action: pan-y`，以横向主导判定接受轻微斜滑并保留纵向原生滚动；Featured 摄影链接 swipe 只切换作品，轻触仍进入详情。
- 粗指针设备的 Hero/Featured 箭头与暂停入口持续可见、可点击；44px 控件几何保持。
- 领养统一详情展示“可领养 / 已领养”；`adopted` 使用不可导航的原生 disabled `PublicAction` 显示“已被领养”。
- 新增 2,771,420 字节 `noto-serif-sc-work-order-common.otf`；制作单常用文本完整嵌入该字体，缺字时完整回退 11,625,800 字节原字体，两条路径都保持 `subset: false`。
- 制作单响应返回真实 `Content-Length`；管理端先显示“正在生成制作单…”，收到响应后按实际已读字节显示 KB/MB、总量与百分比。
- 私有设定图路径未做缩放、降质或有损转码；JPEG/PNG 保持原内容嵌入，WebP 保持既有无损 PNG 解码。
- Noto 派生字体已登记到 manual asset registry；既有 796 条 Linux/x64 production package notices 原样保留，只重算 manual asset 摘要与生成输出。

## Locked Decisions

- 不通过压缩、缩放或降低设定图画质换取 PDF 体积。
- 不恢复会让部分 PDF 阅读器显示方框的 fontkit 运行时 CJK 子集。
- 不新增手势库、数据库字段、迁移或第二套领养详情模型。

## Validation

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test:core`：57 files / 300 tests 通过。
- 定向 smoke：手机整幕/Featured 图片真实触摸 1/1；available/adopted 详情 1/1。
- `pnpm build`：通过；compact/full 字体均进入 production output。
- PDF 阅读器兼容性、真实设定图画质与生产 3Mb 下载手感按用户决定留给人工验收。

## Open Issues

- 仍需用户用真实委托资料人工检查最终 PDF、下载进度和目标阅读器。
- 真实 iOS/Android 的手势手感继续属于 GATE-E 人工验收，自动化不代签。

## Regression Risks

- 单据含精简字体未覆盖的生僻字时会诚实回退完整字体，下载仍会回到原来的较大体积。
- 代理若移除 `Content-Length`，前端继续显示真实已下载字节，但不显示总量/百分比。

## Next Task

- 用户在本分支/后续部署版本上人工验收 PDF 与真实触摸设备。

## Do Not Start Yet

- 未获明确发布授权前，不触发镜像发布、部署、生产迁移或生产数据操作。
