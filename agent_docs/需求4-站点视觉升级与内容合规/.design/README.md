# 需求4 · 站点视觉与交互设计说明

> **角色**：把需求4的品牌、首页、响应式、动效、管理端编辑和进度反馈转成可验收的设计约束。
> **状态**：2026-08-24 仅阶段 E 开放；`GATE-V08-R` 已由凌巽本人放行，V09 Shared Visual Language / Homepage Featured Works 与 V10 Homepage Commission / `/commission` 静态重构已完成。当前停在 V10 Handoff，等待凌巽人工验收，不进入 V11；真实手机和最终人工视觉验收仍待执行。
> **风格定义**：**简洁底盘 + 灵动角色感 + 摄影主导的编辑式工作室网站。**

V09 起的跨页面静态语法以 [`SHARED_VISUAL_LANGUAGE.md`](./SHARED_VISUAL_LANGUAGE.md) 为执行契约；V10 已将其扩展到 Homepage Commission Service Docket 与 `/commission` Photographic Service Ledger。契约统一 wayfinding、摄影圆角、摄影/文字关系与响应式原则，但禁止把所有页面做成同一模板。

## 1. 设计方向

DITE DOG 不做科技发布会的复刻，也不回到国内工作室常见的等权卡片墙。页面保留白底、短文案和明确层级，但兽装角色应该通过图片、节奏和反馈显得有生命，而不是所有内容只做同一种淡入。

三个核心原则：

1. **图片先说话**：大图承担情绪和角色识别，文字负责命名、说明和行动。
2. **一个视口一个主角**：同一时刻只有一个主要画面或行动抢占注意力。
3. **动而有因**：角色会回应点击、切换、进入和完成；没有用户/阅读原因时不持续晃动。

Apple Design Skill 在本需求中的价值是即时反馈、空间一致性、路径可解释和 reduced-motion；它不是“把一切压成无情绪淡入”的风格指令。

## 2. 首页四幕

```text
品牌 Hero
  ↓
代表作品
  ↓
自设委托
  ↓
设定领养（单项）
```

四幕覆盖全部核心业务，但面积、节奏和行动数量不相等。

### 2.1 第一幕：品牌 Hero

- 继续使用全视口横/竖独立图片。
- 仅冻结“有点小狗工作室”品牌文字的最终状态：内容、字体资产、最终视觉尺寸、weight、letter-spacing、line-height、最终位置、对齐和最终排版关系。
- 品牌文字允许一次性 stagger / reveal / 小幅 translate + opacity / clip / mask / 极轻 settle；动画结束后必须精准回到冻结终态，后续换图不重复，Reduced Motion 直接显示终态。
- DITE DOG 与 slogan 文案不改，但视觉层级和一次性进入时序可在 V01 重新设计。
- Photography、crop/focal presentation、media composition、scrim、mask/clip、image transition、autoplay presentation、arrows/pagination/pause-resume、controls grouping/appearance/reveal、pointer/touch/keyboard presentation、media settle、directional motion、scene arrival/departure、Hero → Featured continuity 与 Mobile Hero composition 均在 V01 开放。
- 控制器继续是辅助层，必须保留可暂停、可恢复、键盘/触控可获得、可预测焦点与不因显隐造成布局位移的语义；具体外观、分组、位置和唤起策略不冻结。
- V01 的阅读顺序以 Media → Brand → Supporting Copy → Controls 为探索起点；Hero 应比 Featured 更安静、更电影感、摄影更大、UI 更少。
- Hero 轮播仍为 10 秒、可暂停、页面隐藏暂停、reduced-motion 停止。

建议阅读时序为 Photography 初始可见 → Media settle → 中文品牌一次性入场 → DITE DOG → slogan → controls；具体数值由 V01 实画面确定，不预锁。

### 2.2 第二幕：代表作品

以下条目描述 V00 之前的当前生产基线，不是后续视觉冻结项。V03 将在保留代表作品资格、最多两项、真实链接和业务数据契约的前提下，把 V00-F1 B + M3 baseline 正式落地；不得把旧双图布局或 B + M3 具体轴线机械复制到其他 Scene。

- 只保留一个停靠幕，最多两件代表作品；标题复用委托/领养的左上结构，桌面标题下方左侧并排两张 3:4 竖图，右侧承担说明和行动。
- 代表作品必须至少有一张 READY 竖版出厂照；图片优先使用竖版主图，否则使用顺序最前的竖版出厂照。
- 隐藏名称与物种，让图片本身获得更大面积；不增加营销说明。
- 两张图片分别进入对应详情；右侧只保留一个 `浏览作品展示` 按钮进入 `/works`，不设置逐图按钮、“查看全部作品”或左右轨道按钮。
- 不再存在 lead/secondary 两种 type、第二个“代表作品”标题、`01/02` 页次或横向轨道。
- 桌面图片在保证标题、说明、按钮同屏和底部仍有呼吸空间的前提下尽量放大；`>=1280px` 上限为 360×480，1440px 宽视口双图间距为 56px。移动端文字在上、双图在下，不依赖横向滑动。

角色感：

- fine pointer hover 只对命中的单张图片轻聚焦，不让整行同时移动；触控端不模拟 hover。
- hover 命中区只限图片本身；鼠标离开图片即以 state 时序回落，不延续到右侧目录按钮。
- reduced-motion 关闭图片 transform，内容仍在 SSR 首屏默认可见。

### 2.3 第三幕：自设委托

- 移除 21:9 描边业务卡视觉，改为完整章节。
- 桌面采用非对称分栏：图片约占 65%–75%，文字占其余空间。
- 桌面把图片放在右侧，与代表作品、设定领养形成左—右—左交替；移动端图片仍在上。
- 只保留短说明“先通过站内表单提交。工作室评估后优先使用官方 QQ 私聊沟通。”，不在首页重复邮箱说明或章节标题。
- 行动为 `了解自设委托` 与 `提交委托申请`，后者为主行动。
- 与 `/commission` 使用同源图片、相近焦点和裁切，建立对象连续性。
- 首页委托大图只展示，不可点击；进入详情和申请仅通过明确按钮。
- 移动端图片在上、文字在下，保持原生纵向阅读。

### 2.4 第四幕：设定领养

**首页永远只考虑一项。**

- 取排序后的第一项 `available`。
- 使用单幅完整展示，不做一大一小、双卡、拼版或轮播。
- 横版 `adoption_cover` 优先；缺失时沿现有规则回落到完整设定图。
- 名称、物种、状态和可选价格作为清楚 caption，不叠加到角色脸部。
- 行动为 `浏览设定领养` 与 `查看当前角色`，分别进入 `/adoptions` 和对应详情。
- 领养营业状态与委托营业状态使用同一组件；它说明章节整体是否开放，角色的 `可领养` 则继续说明当前单项状态，两者不互相替代。
- 在 1440×900、1024×900、768×1024、430×932 和 390×844 中，从章节起点进入视口后，无需第二次滚动即可同时理解章节标题、角色图、名称/物种、状态和两个行动；可选价格存在时也进入同一信息闭环。
- 图片不必为了“单幅”填满全部内容宽度；允许用媒体最大高度、居中留白或桌面图文编排保证一屏表达，但不得把 caption 压到角色脸部或把角色缩成目录缩略图。
- 没有开放领养时隐藏整幕，即使存在已完成领养。
- adopted 不进入此幕，但仍可进入首页精选。

这幕作为首页收尾，应比商品列表更像一张“当前角色海报”：单图、大留白、明确状态。

### 2.5 桌面逐幕滚动

- 仅 `min-width: 1024px` 启用；1023px 及以下继续原生纵向滚动和现有横/竖 Hero 素材逻辑。
- wheel 顺序固定为 Hero → 代表作品 → 自设委托 → 设定领养 → Footer；向上按相反顺序。用户从 Hero 连续完成两次有效下滚后进入自设委托。
- 每个业务幕只占一个动态视口；代表作品不得再拆成第二个停靠点。
- Header 固定在视口顶部，离开 Hero 后切换为可读实底；滚动容器只保留一份 Header offset，当前幕直接接在 Header 下方。
- 代表作品左上标题、下方左侧双图与右侧说明/唯一目录按钮从固定 Header 下方开始，并在同一动态视口内完成；没有轨道按钮。
- 动画进行中锁住重复 wheel 约一个过渡周期；`ctrl/meta/alt/shift`、输入控件、可编辑区和对话框不拦截。
- reduced-motion 仍逐幕导航，但使用即时定位；无 JavaScript 时依赖 CSS scroll snap，自然退化。

## 3. 作品与领养目录

### 3.1 `/works`

- 目录继续展示全部可公开作品、搜索和分页，不把“代表作品资格”误用成完整目录过滤条件。
- 恢复上一轮按来源比例的横竖等高混排；任何作品有出厂照时先用出厂主图，完全没有出厂照的领养作品才回落独立横版领养封面，封面缺失时再沿既有规则回落设定图。
- 同一行等高、宽度随横竖比例伸展；移动端单列，末行不拉伸成巨图。
- 卡片仍以图片和名称/物种进入详情，焦点、hover 和 reduced-motion 沿用同一 `WorkCard`。

### 3.2 `/adoptions`

- 目录仍展示全部开放和已完成内容、搜索和分页。
- 服务端顺序固定：开放领养在前，已完成在后；组内按修改时间倒序。
- 页面直接消费服务端顺序，不在客户端再按价格、发布时间或 DOM 状态重排。
- 卡片状态必须有文字，不只依赖颜色。
- 修改作品为已完成后，它进入已完成组，不得因为刚刚修改而跑到开放项之前。
- 搜索过滤后保持原相对顺序，再分页。

## 4. 动效语言

本节的通用原则仍有效；具体 Homepage Directional Motion 以 [Visual Direction v2](./VISUAL_DIRECTION_V2_2026-08-22.md) 为当前解释。V00-F1 已确认 Media 振幅最大、Main Title 次之、Meta / Description 更小、CTA 最小，背景 Typography 与 folio 静止。

### 4.1 两层性格

**底层：安静、准确。**

- 页面结构、表单、法务文本、后台操作不晃动。
- 进入/退出路径一致，反馈立即出现。
- 不为“高级感”堆 blur、阴影、材质或漫长动画。

**强调层：角色有回应。**

- 图片、轮播控制、CTA 图标、选择和成功状态可以有一次轻弹性。
- 允许遮罩揭示、图文错峰和轻微 tilt/scale。
- 角色感只发生在可感知的关键节点，不成为持续背景噪声。

### 4.2 运动语义

| 语义 | 方向/形式 | 适用 |
| --- | --- | --- |
| 阅读进程 | 8–24px 纵向、clip/mask | section、标题、caption |
| 媒体关系 | crossfade + 2%–4% 横向/缩放 | Hero、图集、共享对象 |
| 直接反馈 | `scale(.97–.99)` + 短回弹 | 按钮、控制器、可点击图 |
| 角色聚焦 | 上移 2–4px、scale 1.02–1.04、tilt ≤ .8° | fine pointer 卡片/图片 |
| 完成反馈 | 一次轻 overshoot/图标描画 | 上传完成、发布成功、提交成功 |

### 4.3 时间与 easing

建议 token：

```text
--motion-duration-feedback: 120ms
--motion-duration-state: 180ms
--motion-duration-content: 420ms
--motion-duration-media: 720ms

--motion-ease-standard: cubic-bezier(.22, 1, .36, 1)
--motion-ease-playful: cubic-bezier(.2, 1.16, .32, 1)
--motion-ease-linear-progress: linear
```

- playful easing 只用于图标、控制器、图片聚焦和短成功反馈。
- 正文、错误、法务和 destructive 确认只用 standard。
- 普通路由若使用短 opacity，只消费 `state`，不另建 300ms 级 page token。
- 不把所有组件锁死到同一毫秒；允许在 token 范围内小幅校准，但测试不断言精确时长。

### 4.4 输入模态

- **自动轮播**：可以使用完整 `media` 时序，访客没有等待显式命令完成；仍固定 10 秒一张。
- **鼠标/触控点击**：pointer-down/press 先在 `feedback` 时序内立即回应，再进行短于自动轮播的媒体交接；控制器显隐不延迟切换。
- **键盘**：方向键、分页点和暂停/继续即时生效，图片只允许即时替换或约 120–180ms 的短 crossfade，不强制观看完整媒体动画。
- **拖动**：只有做到 1:1 跟手、可反向、可中断、释放速度连续并不抢占纵向滚动时才实施；否则保留离散切换，不在 pointer-up 后补一段伪物理滑动。

### 4.5 动效预算与拒绝项

- 一个视口最多一个主要大对象运动。
- 大图切换时，Media 承担最大方向位移；标题、Meta / Description、CTA 逐级减弱，禁止所有层同距离一起横移。
- 页面切换期间不启动 section reveal。
- 自动轮播之外不使用空闲循环动画。
- hover 离开沿同一路径返回，不突然切换方向。
- 动效不可延迟路由、请求、焦点、错误提示和操作可用性。
- 普通公开路由默认即时切换，最多使用约 120–180ms、不阻塞的 opacity；不把全站 `out-in + translateY` 当作统一目标。
- 非 hash 导航必须先把目标页面定位到顶部再呈现；当前页品牌/导航入口重复激活时也回页头；返回/前进等待目标页重新具备可滚动高度后恢复历史位置，hash 目标继续让开 Header。
- 首页各幕内容 SSR/无 JavaScript 默认可见；不得继续让所有章节统一上浮淡入，再以 JavaScript 到达视口作为内容可见前提。
- 拒绝全面卡片 tilt、所有 CTA 回弹、Footer 整体入场、键盘长媒体动画、持续 Ken Burns/呼吸/视差/粒子，以及没有完整手势模型的拖拽。

## 5. 移动端与偏好

### 5.1 移动端

- 1023px 及以下保持原生纵向滚动、`100svh/100dvh`、safe area 和动态地址栏。
- 不依赖 hover，不在触控端应用 tilt。
- Mobile 是同一 Art Direction 下的重新构图，不是 Desktop CSS 缩小版；允许与 Desktop 使用不同 position、grouping、density、reveal strategy 和 motion 参数。
- 每完成一个 Homepage Scene 立即检查 390×844 与 430×932，不等 Desktop 全部完成后再首次检查 Mobile。
- Hero 独立检查 focal/crop、品牌与主体冲突、scrim、controls、pagination、pause/resume、44px target、品牌入场时长和 Hero → Featured continuity。
- Featured 保持摄影第一焦点、folio 降权、背景 Typography 静止和轻量 44px 翻页；Commission 重新安排 media/copy/CTA；Adoption 以完整设定图和 contain / art-directed canvas 优先。
- 表单输入法打开时，字段错误、确认项、进度和主按钮仍可见可达。

### 5.2 Reduced preferences

- `prefers-reduced-motion`：关闭自动轮播、tilt、overshoot、错峰、大位移和共享对象飞行；保留短淡化或静态变化。
- `prefers-reduced-transparency`：Header/浮层改为实底，关闭 blur。
- `prefers-contrast: more`：提高底色不透明度、文字和边界对比。
- 无 JavaScript：内容默认可见，导航和核心链接仍可用。

## 6. 公开行动组件

统一组件只提供三种视觉角色：

- `primary`：章节唯一主行动；
- `secondary`：低强调边框/浅底辅助行动；
- `text`：文字 + 箭头或短下划线动效。

要求：

- 同一组件支持 `NuxtLink` 和 `button` 的正确语义；
- loading/disabled/focus-visible/active 统一；
- 按下时立即反馈；
- 箭头移动或下划线可以有角色感，但不改变布局；
- about、commission、adoptions、首页、空态不再各自复制按钮 CSS。

## 7. Header 与 Footer

### 7.1 Header

- 首页覆盖态可使用一层轻材料；内页 sticky 状态保持稳定。
- 导航不需要每项都大幅浮起和投影；active、hover、focus 清楚即可。
- 允许 nav 文本/chevron 有短、灵动反馈，但不把导航做成 SaaS 胶囊组件展示。
- 真实 Hero 图上验证对比度。
- 首页滚动时保持 `position: fixed`；超过 Hero 顶部阈值后切换为浅色实底、深色文字和正常 Logo，reduced-transparency 下取消 blur。

### 7.2 Footer

- Footer 的品牌、导航、备案、版权、法务和设计署名内容全部冻结。
- Footer 的布局、样式、响应式和交互全部冻结；不添加持续动画、链接反馈或新的收尾 padding。
- 桌面逐幕导航仍把 Footer 作为最后一个停靠点，但后续任务只验证相邻页面不会覆盖或挤压 Footer，不修改 `PublicFooter.vue`。

## 8. Hero 管理端

### 8.1 保留独立素材

横版和竖版单独维护是正确方向：

- 构图目标、主体位置和可读安全区不同；
- 自动把横图裁成竖图会损害角色；
- 首页横/竖数量和顺序可以不同；
- 委托横/竖各自只有一个启用槽。

因此不合并数据库、不建立 pair、不要求同一角色或相同顺位。

### 8.2 重组信息架构

当前四个平级 Tab 改为：

```text
一级： 首页大图 | 委托页大图
二级： 横版 | 竖版
```

- 一级代表页面/业务目的，二级代表设备方向。
- 顶部持续显示两方向摘要，例如 `横版 3/5 · 竖版 2/5`。
- 首页和委托页都只显示当前横/竖 Tab，不在宽屏同时展开两个方向。
- 顶部保留两方向计数摘要；未完成方向可显示待检查/处理中提示，完成方向不重复显示“已就绪”。
- 提供桌面/手机画框预览切换；预览使用目标比例和焦点。
- 四集合仍由同一 editor 组件参数化驱动，各自使用独立 version/CAS。

### 8.3 可拖焦点与控制条

- 仅未启用 item 可编辑。
- 预览使用目标横/竖比例和真实 cover 裁切；焦点标记可以在画面内按下并连续拖动。
- 同时提供水平、垂直 `range` 控制条，显示当前百分比并用于精调；不再提供九宫格预设。
- 默认中心；已有任意坐标原样显示，只有用户拖动或调整滑杆时才更新。
- 修改后需重新发布，旧图在新变体验证后清理。

## 9. 管理端行动、上传与进度

### 9.1 通用进度组件

统一为 `AdminTaskProgress`（名称可等价调整），支持：

- `determinate`：真实 value/max；
- `stage`：阶段、计数、状态；
- `indeterminate`：未知百分比 + 经过时间；
- `success/error/cancelled` 终态；
- 可选 retry/cancel 行动。

视觉结构建议：

```text
当前任务名称                         已等待 12 秒
当前阶段 / 已完成 3 / 8
[────────────── progress ───────────]
失败或重试说明（仅需要时）
```

### 9.2 OSS upload

- digest、创建会话、上传、服务端校验形成同一可见阶段链。
- uploading 使用 XHR 已发送字节的真实百分比。
- Hero、二维码、水印、作品图上传都复用同一进度表达，不只显示“上传中…”。
- 上传失败保留用户文件/预览和明确重试入口。

### 9.3 FFmpeg

- 当前单图 FFmpeg 调用没有可靠总工作量，不显示虚构百分比。
- 显示“正在准备私有处理源 / 解码图片 / 生成适配图”等真实阶段和 elapsed。
- 如果未来服务端提供可信帧/字节工作量，可升级为 determinate；不能为了进度条解析不稳定 stderr。

### 9.4 持久 operation

- Hero、作品 publication、branding rebuild、下架清理使用服务端真实状态和计数。
- 不再把 `PREPARING_SOURCE/GENERATING_PUBLIC/...` 人为映射成 12/35/56/91 百分比。
- 刷新页面后恢复 operation 进度；lease/recovery 状态不暴露技术细节给普通业务用户。
- 成功/失败反馈保持可见，直到用户开始下一次操作或明确关闭。

## 10. 测试与人工设计验收

自动 smoke 只检查：

- 页面可加载、主要行动可达；
- 无明显空白/横向溢出；
- reduced-motion 可用；
- 上传/长任务有进度状态；
- 领养排序与单项投影符合业务契约。

自动测试不检查：

- 精确动画毫秒；
- 完整文案全文；
- scoped class/DOM 层级；
- “是否足够好看”；
- 真实角色主体是否被裁坏。

王旻安/景宸人工验收至少覆盖：

- 1440×900、1024×900、768×1024、430×932、390×844；
- 一台真实手机；
- 真实首页/委托/领养图片；
- 动效开始、打断、返回和 reduced-motion；
- Hero 静默态、键盘/触控唤起、暂停后恢复入口，以及控件重新隐藏时不改变画面布局；
- 首页领养从章节起点进入视口后，同屏看到章节标题、角色、名称/物种、状态和两个行动；
- 首页 ≥1024px 的 Hero/代表作品/委托/领养/Footer 逐幕 wheel 顺序、反向、锁定、第二次有效下滚进入委托，以及 1023px/768/移动端不拦截滚动；
- 首页代表作品左侧最多两张竖图、右侧说明与唯一目录按钮全部一屏；`/works` 横竖等高混排且有出厂照优先出厂照、无出厂照才回落领养封面；
- 首次 Hero 加载无“完整显示 → 闪烁 → 再放大”；委托复制邮箱前后按钮顶边稳定；
- autoplay、pointer/touch、keyboard 的不同节奏；若实现 drag，逐项验证跟手、反向、中断、速度和纵向滚动；
- Hero 管理横/竖切换与进度；
- 页面整体是否既简洁又有角色生命感。
