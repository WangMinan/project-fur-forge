# TASKS：联系面按钮化与身份行收敛（阶段 E 本轮迭代）

> **日期**：2026-08-24　**分支**：`codex/r4-e-home-scene-typography`
> **依据**：`./DESIGN_BRIEF.md`（方向经王旻安当轮候选方案确认）；上位任务权威仍是 `implementation/TASKS.md`（本文件不勾选 T47/GATE-E）。
> **规则**：`[x]` 已实现并有本地证据；`[ ]` 待做。

- [x] **C1 · 管理端领养封面提示条间距**：`.cover__locked` 补 `margin: 0 0 var(--admin-space-4)`，与同页设定图/出厂照两处同类提示一致。
- [x] **C2 · 领养卡单行身份**：价格与状态合成 `.adoption-card__meta` 贴右端，与名称·物种同行，价格在状态前；删除只为价格存在的 `.adoption-card__details`。
- [x] **C3 · 详情页领养事实**：新增 `publicWorkDetailWorkDtoSchema`（`adoptionStatus`/`price` 均为 optional，仅领养作品带）；服务端复用 snapshot 的 `match.adoption`，不新增查询或迁移。详情头改为两行：名称独占第一行，`物种 价格 状态` 同字号、中线对齐合成第二行，价格用 `tabular-nums`。
- [x] **C4 · 图集方向切换连续过渡**：舞台改由 `aspect-ratio: var(--stage-aspect-ratio)` + 共享 `--gallery-max-height` 决定高度（`auto` 高度无法过渡）；离场图移出文档流且只约束 `inset-inline`，高度与淡化同为 `--motion-duration-content`，同起同落。实测 660→522→429→380→361→351→346→345，不再"卡一下再跳一格"。
- [x] **C5 · 联系清单组件**：新建 `ContactChannelList`（邮箱 + QQ + QQ群 同卡 hairline 行，每行 `标签 / 号码 / 行动`），`/about` 与 `/commission` 共用；删除 `ContactChannelGrid`（无残留调用方）。
- [x] **C6 · 二维码 hover 浮层**：桌面 `(hover: hover) and (pointer: fine)` 下二维码收进 hover/focus-within 浮层，点击照常跳转官方短链；触屏保持常驻，且**无链接的行任何设备都常驻**（扫码是其唯一路径）。
- [x] **C7 · `/commission` 行动收敛**：主行动只保留在 `CommissionLead` 大图内一次，正文不再重复主按钮；两个延伸阅读退为 `variant="text"` 文字链接。可点元素 9 → 6。
- [x] **C8 · 复制反馈浮层化与按钮统一**：复制反馈改为按钮上方绝对定位浮层（实测点击前后按钮 w/x 完全不变，零布局位移）；按钮文字不随状态变化；行动按钮 `min-width: 8.5rem` 对齐成列；号码改正文黑体 + `tabular-nums`。
- [x] **C9 · 真实浏览器验收**：390×844、430×932、768×1024、1023×900、1024×900、1440×900 六视口无横向溢出；键盘 focus 可唤出二维码；`prefers-reduced-motion` 下浮层 `transition: 0s`；触屏 `(hover:hover)` 判定为 false 且二维码按 C6 规则呈现。
- [x] **C10 · 回归验证**：`lint`、`typecheck`、`test:core`（52 文件 / 313 例全绿）、`build` 通过。`public-site-contracts` 的详情 work 断言按新契约更新，并补断言 commission 作品不带这两个字段。

边界（不做）：数据库与迁移、业务契约、媒体/安全边界、部署拓扑；不恢复已退役业务；不新增营销文案；不改 Hero、首页四幕顺序与聚合 DTO。

## 已知偏离

- 删除 `ContactChannelGrid` 后，长驻 dev 服务器会对其已失效的 scoped style URL 报一次 404（模块图缓存），重启即消失，不影响构建产物与生产。
