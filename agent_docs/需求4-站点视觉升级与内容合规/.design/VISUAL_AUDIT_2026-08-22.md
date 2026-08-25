# 需求4阶段 E：全站视觉与动效只读审计

日期：2026-08-22  
性质：Visual Design Spec / 只读审计  
状态权威：implementation/TASKS.md 仍是唯一任务与状态权威；本文不修改任何既有任务状态，不代表 T47 或 GATE-E 已通过。

> 第二轮视觉方向修订见 [VISUAL_DIRECTION_V2_2026-08-22.md](./VISUAL_DIRECTION_V2_2026-08-22.md)。v2 对 Featured Works 的 Portrait-only 范围、Art Direction、Motion、Shared Continuity 和原型 Gate 具有优先解释权；本文保留为第一轮审计基线与截图证据。

> 2026-08-23 边界覆盖：Footer 的内容、布局、样式、响应式和交互现已全部冻结。本文后续关于 Footer 触控盒、链接分组或视觉权重的旧建议仅保留历史记录，不得转成实现任务。

## 审计边界

本轮完整阅读了需求4的任务、视觉方向、冻结范围、实施记录与既有证据，并检查了当前首页、作品、委托、委托申请、领养、关于、作品详情、全局导航和页脚的实现。浏览器检查覆盖 390、430、768、1023、1024、1440 像素宽度，包含首页自动播放、暂停、键盘切换、滚轮正反向、移动导航焦点返回等关键状态。

本轮没有修改应用代码、数据模型、业务逻辑、依赖、现有 TASKS 状态、T47 或 GATE-E，也没有代替用户执行视觉验收。

两个外部参考站点已通过内置浏览器完成只读观察。它们只用于提取层级、媒体主导、交互因果与动效节奏原则，不作为复制其素材、字标、配色、页面结构或业务范围的授权。视觉判断仍以仓库冻结约束、当前实现和本地截图为主。

输入说明写到“T37～T46-F4 已完成”，而当前权威 TASKS.md 已记录为“T37～T46-F8 已完成”。本文按 TASKS.md 的当前状态理解，仅 T47、GATE-E 与人工视觉验收开放；这只是状态冲突报告，没有修改任何勾选。

## 外部参考站只读观察

观察日期：2026-08-22。参考站为 [Halo Sea](https://hal-sea.netlify.app/) 与 [WW-PASS](https://www.ww-pass.com/)。下列数值来自浏览器中当时页面的实际计算样式与交互状态，只描述可借鉴原则；参考站后续改版不改变本文结论。

### Halo Sea

**观察到的视觉与加载 / 交互行为**

- 暖色浅底、柔和渐变、手绘品牌图、大号超粗中文标题和黑色悬浮圆角导航共同形成强角色品牌感；估价表单使用大块白色圆角容器，视觉更接近品牌化产品工具。
- 刷新完成时，Hero 品牌图、Eyebrow、逐字拆分的 H1 与说明保持静止和立即可读，没有整页统一 reveal；可见的入场重点仅是导航白色圆点从 `translateY(8px) scale(.84)` 到原位，时长 420ms。
- 导航指示器位移使用 420ms 弹性曲线；当前项目文字下移 10–12px，图标以 140–260ms 淡出并上移缩小；切换可被下一次选择覆盖。导航在滚动后保持 sticky，桌面 top 为 22px。
- 制作系列选中卡只上移 4px，并在约 260ms 内改变背景和阴影；反馈明确，但没有整张卡大幅弹跳。
- 上传图标使用 3.2s 呼吸循环，在一个周期内短暂上移 4px、放大约 1.035；它强化上传入口，却也是页面唯一明显的持续提示噪声。

**可借鉴**

- 首屏只保留一个最强叙事焦点；加载完成后不要让品牌图、标题、说明同时竞争入场动画。
- 若需要活泼感，把弹性限制在一个状态指示器或控件到达动作中，并把容器、标签、图标拆成有因果的时序，而不是整区弹跳。
- sticky 导航的选中态可以同时给出位置、文字和图标反馈，但内容与键盘语义必须始终可用。

**不借鉴**

- 不复制暖粉配色、卡通字标、大型 SaaS 式表单卡和五项业务导航；这些与 DITE DOG 冻结的黑白摄影画册方向及业务范围不一致。
- 不把 3.2s 呼吸循环移植到 DITE DOG 的主按钮或上传区；如需提示，优先使用用户触发或一次性到达反馈。

### WW-PASS

**观察到的视觉与加载 / 交互行为**

- Hero 使用无圆角的全宽兽装摄影，白色导航、字标与简洁 CTA 叠在画面上，UI 主动后退；下一模块用超大黑白字形和角色抠图建立纵深，再接两张高饱和圆角业务卡。
- 页面加载条的 transform 约 100ms，height / opacity 约 400ms；Header 颜色变化主要为 150–500ms，CTA hover 约 150ms，仅做黑白反转，没有缩放或弹跳。
- Hero 是可拖拽横向 Swiper，接近左右边缘才显露箭头；活动区标题用约 300ms、±68px 的方向位移，副标题 / 动作用约 300ms、±20px 位移并延迟约 300ms，拖动反向时视觉方向也随之反向。
- 活动区保留多段 muted loop 视频，但只有当前媒体播放、非活动媒体暂停；这是一种对持续媒体噪声的局部约束，而不是全页不停运动。

**可借鉴**

- 摄影承担第一视觉主体时，导航、按钮和说明应更简单；DITE DOG 的 Hero 与委托模块可继续沿用这种“媒体先行、UI 后退”。
- 用标题较大位移、说明较小位移和稍后出现的操作建立同一交互的层级；方向反馈需支持拖动或导航反向，不能只会向一个方向播放。
- CTA 用颜色 / 边框反转即可表达 hover，无需额外弹跳；非活动媒体停止播放是控制视觉和性能噪声的有效规则。

**不借鉴**

- 不复制其彩色品牌体系、产品字标、持续视频背景或 Header 离开视口的行为；DITE DOG 已冻结固定 Header、静态摄影与更安静的黑白底盘。
- 不为模仿参考站而新增依赖、视频内容、全站 Swiper 或全局加载动效。

### 对 DITE DOG 的合成结论

DITE DOG 应吸收 Halo Sea 的“单一首屏焦点与局部弹性状态”，以及 WW-PASS 的“媒体主导、方向可逆、次要信息低振幅”，但继续使用自己的 120 / 180 / 420 / 720ms 语义时长。Halo Sea 的 420ms 圆点到达可以映射到现有 `content + playful`；WW-PASS 的 300ms 层级切换只证明中等时长有效，不构成新增 300ms token 的理由。弹性只用于状态指示器或一次性到达，CTA、正文、Footer 和整段页面不做持续呼吸或统一 reveal。

# Part A — 当前状态

## A1. 已成立的视觉底盘

- 当前视觉方向“简洁底盘 + 灵动角色感 + 摄影主导的编辑式工作室网站”已能从首页、委托页和详情页中辨认出来。
- 首页结构符合冻结顺序：Hero → 代表作品 → 自设委托 → 单项领养 → Footer。
- Hero 的中下区域主文案、固定标题字体、摄影裁切和渐变遮罩在桌面与移动端均具有可读性。
- 1024 像素及以上进入桌面滚轮分屏；1023 像素及以下保持原生滚动。边界行为与冻结约束一致。
- Hero 默认仅显示圆点，细指针接近控件区、键盘操作或触摸后再显示方向与暂停控件；暂停后恢复按钮保持可见。
- Header、桌面下拉和移动导航的圆角、描边、字重与交互风格基本一致。移动导航可通过 Escape 关闭并把焦点还给菜单按钮。
- 作品、领养、委托、关于和详情页没有发现正向水平溢出；主要图片均能加载并解码。
- 动效已按输入意图区分：自动播放较慢、指针反馈适中、键盘反馈较快；未出现全站统一 reveal、整区倾斜、Footer 入场或伪拖拽。

## A2. 统一与割裂

- **风格最统一**：Hero、首页委托与 Work Detail 的“摄影为主、UI 后退、交互后才出现轻微生命感”最接近目标；Header、桌面下拉、移动导航和 PublicAction 的描边 / 圆角 / 焦点语言也基本一致。
- **风格最割裂**：单项 FeaturedWorks 仍显得像未完成的双列模板；首页领养把设定图当摄影封面裁切；About / Apply 的页面标题和正文不在同一个编辑网格。这三处最容易把成熟的画册感拉回“开发中页面”。

## A3. 当前最影响“高级、克制、灵动”的问题

| 优先级 | 页面 | 组件 | 当前表现 | 为什么是问题 |
| --- | --- | --- | --- | --- |
| P0 | 首页 | FeaturedWorks | 只有一项内容时仍保留双列轨道；390px 媒体约 158 × 210，430px 约 178 × 237；1023–1440px 留下大块空白，说明漂到远端 | 单项内容被缩成“半张卡”，视觉中心和图片主导原则同时失效，明显暴露模板状态 |
| P0 | 首页 | HomeCurrentAdoptions | 固定高度配合 object-fit: cover；横版角色设定图在 390、430、1024px 丢失大量左右角色信息 | 设定图承担角色说明而非氛围封面；裁掉身体、尾部或相邻角色会直接损害内容理解 |
| P1 | About | PublicPageIntro + about-page 主体 | 1440px 下标题靠页面左侧，正文进入居中的窄栏，两者没有共同对齐线 | 阅读起点断裂，宽屏留白看起来是偶然空洞而不是有意的编辑式留白 |
| P1 | About / Commission | ContactChannelGrid | 只有 QQ 和 QQ群两卡时仍平均拉伸正文栏；桌面 QR 与卡片显得过大 | 二维码从“联系入口”变成页面主视觉，抢走摄影和正文层级，也降低页面的克制感 |
| P1 | Commission Apply | PublicPageIntro + commission-apply form | 页面引导与 46rem 表单列的起点不同；每个空错误位常驻约 1.25em 高度 | 用户扫描表单时横向骨架断开，空错误位累积成大段无意义间距，像默认表单而不是成品页面 |
| P1 | 全站 Footer | PublicFooter mobile links | 移动端法务和导航使用小号行内链接换行，视觉较轻，部分交互盒不足 44px | 信息架构虽正确，但触控可达性和结束区层级弱，长页面末尾显得仓促 |
| P2 | Header / Hero / Catalog / Detail | 内联 SVG 与字符箭头 | Header / Hero 使用描边 SVG，分页使用 ‹ / ›，详情返回使用 ←，邮件动作使用 ↗ | 字符字形随系统字体变化，粗细、基线和箭头角度不一致，削弱黑白 UI 的精确感 |
| P2，待确认 | Work Detail | WorkDetailGallery + 现有 watermark profile | 中心水印面积和对比度偏强；部分源图还带角标，出现“双水印”印象 | 水印与角色面部竞争，摄影不再是第一视觉主体；但保护强度属于产品 / 合规权衡，不能自行调整 |
| P2 | 首页与公共控件 | useHomeSectionNavigation / PublicAction / 局部 transition | 主 token 已是 120 / 180 / 420 / 720ms，但仍有 620ms lock、700ms spinner、150ms 过渡及 40 / 90 / 100 / 270ms delay | 当前未造成明显故障，但同类反馈逐渐形成多个节奏，后续调整容易出现不可预测的中断与反向差异 |

## A4. 页面级观察

### 首页 Hero

桌面图像、标题位置和主文案层级稳定；移动端为左对齐但仍位于中下区域，符合当前冻结约束，不建议为“统一”而强制改成居中。自动播放、暂停、键盘、细指针显隐和 1024 桌面滚轮锁均按预期工作。

### 首页代表作品

双项布局的基本语言成立，细指针 hover 约为 1.025 倍缩放和极轻旋转，也符合现有动效方向。主要缺口是单项布局和 768–1024 区间的独立构图，不应只跟随桌面导航断点切换。

### 首页委托

桌面的非对称摄影构图和移动端纵图切换都较成熟。后续只需要微调正文行长、遮罩密度与状态信息间距，优先级低于代表作品和领养裁切。

### 首页领养

信息层级、状态和行动按钮清楚；问题集中于角色图被 cover 裁切。应保留单项领养和一屏可读目标，只调整媒体呈现模型。

### 作品与领养目录

响应式网格、搜索、状态与价格信息可读，移动端单列成立。当前测试数据中包含 Logo 类素材，会影响页面观感，但这是内容选择，不是结构缺陷。本轮不调整数据。

### About / Commission / Contact

文字可读，移动端两列 QR 仍可辨识；桌面端两张 QR 卡会被拉得过宽。应建立共享编辑栏对齐，并给 ContactCard 设定紧凑上限。联系方式范围继续锁定为 Email、QQ、QQ群。

### Commission Apply

控件宽度和移动端触控尺寸成立；每个字段为空时仍预留错误区域，使表单出现不必要的大段垂直间隙。应在不造成错误出现时布局跳动的前提下，减少空错误位的常驻高度。

### Work Detail / Gallery

移动端图片优先、缩略图和文字层级清楚。现有中心水印视觉较强，部分源图似乎还带有角标，形成“双水印”印象。水印强度属于内容保护和视觉权衡，必须先确认，不能由本轮直接改动。

### Header / Mobile Navigation / Footer

Header 与移动导航没有需要推翻的结构性问题。Footer 的信息架构和法务备案底部位置必须保持，后续只优化移动端触控面积、链接分组和视觉权重。

## A5. 验证限制

- 本轮未在真实手机上测试；390 与 430 为浏览器视口。
- 当前浏览器能力无法可靠模拟 prefers-reduced-motion、reduced-transparency 和对比度偏好；代码路径已检查，但仍应留给 T47 和人工验收。
- 未替用户完成主观视觉签字；GATE-E 必须保持未通过。

# Part B — 决策矩阵

## LOCKED

- 本轮与后续实现限定在需求4阶段 E 的视觉和动效范围。
- 首页结构与模块顺序保持不变。
- Hero 标题字体资产与预加载策略保持不变；按凌巽 2026-08-24 的最终反馈，保留 V01 已确认的一次性 clip/位移入场，禁止字体替换闪动或换图重播。
- Hero 主文案保留在中下 / 下中区域，不因统一布局而移至顶部。
- Footer 信息架构固定，法务、备案和许可信息继续位于最底部。
- 首页领养保持单项；代表作品最多两项并继续要求可用的纵向工作室照片。
- 联系方式保持 Email、QQ、QQ群，不恢复五平台或旧范围。
- 现有文案、路由、业务逻辑、数据模型与发布逻辑不在视觉任务中变更。
- 1024 像素及以上为桌面滚轮分屏，1023 像素及以下为原生滚动。
- 不恢复动态、返图墙、FAQ 或复杂首页区块。
- 不新增全局 reveal、Hero 伪拖拽、Footer 入场、整区 hover 或会改变内容顺序的动效。
- Route / shared-object transition 继续只服务已确认的首页委托与首页领养出站路径，不扩成全站花哨转场。

## FLEXIBLE

- 模块内部的留白、密度、列宽、网格比例和文字行长。
- PageIntro、正文、表单和媒体的共享对齐线。
- QR 卡片与图片的最大宽度。
- 单项 / 双项代表作品的响应式构图。
- 已发布派生图在展示画布内使用 contain 或 cover，以及画布背景。
- 细指针 hover 在当前克制范围内的振幅。
- delay、loop、wheel-lock 等辅助 motion token 的命名。
- Footer 链接在移动端的分组和触控盒形态。
- 768–1023 区间的媒体 / 文案列关系。
- 表单错误区的稳定占位策略。
- 现有内联 SVG 与字符箭头的几何统一方式，但不得为此默认安装 icon package。

## RECOMMENDED

- 为 FeaturedWorks 增加 1 项 / 2 项显式布局状态。
- 将首页角色设定图改为 contain 的艺术指导画布，优先完整呈现角色。
- 建立跨 About、Commission、Apply 的共享编辑式内容网格。
- Contact QR 使用紧凑 auto-fit 卡片，不让两张卡撑满正文栏。
- 移动 Footer 交互项达到至少 44 × 44 像素触控盒。
- 把局部 620 / 700 / 150ms 与零散 delay 收束进 motion token 体系。
- 减少 Commission Apply 的空错误位，同时确保错误出现时页面稳定。
- 以固定视口矩阵做最终一致性证据，不以单个桌面截图代替响应式验收。
- 用仓库内小型 SVG / CSS 方案统一箭头与关闭图标的线宽、viewBox、尺寸和基线。

## NEEDS_CONFIRMATION

- 中心水印的最终透明度、相对尺寸、位置和是否允许因角色面部避让而偏移。
- 视觉验收前是否继续公开展示当前 Logo / 测试素材型作品。
- T47 最终采用哪些真实手机和浏览器做人工验收。
- 横版角色设定图使用 contain 后产生留白时，可接受的画布背景与留白比例。
- 除冻结的 Hero 品牌字外，是否需要把当前依赖操作系统的中文 display serif 固定为随站字体；若要固定，需先确认视觉字样和已有字体资产的公开站用途。

# Part C — Visual Design Spec

## C1. Typography and Font Family

### 当前实际字体

| Token / 角色 | 当前字体链 | 审计结论 |
| --- | --- | --- |
| brand display / Hero 与品牌 | Zhuohei Collage Critical → Zhuohei Collage → PingFang SC → Microsoft YaHei → sans-serif | 冻结。Critical WOFF2 约 19KB，在 head 预加载并使用 font-display: block；完整 TTF 使用 optional，避免首屏晚换字 |
| public display / 中文页面标题 | Songti SC → STSong → Noto Serif CJK SC → serif | 所有主要页面通过同一 token 使用，但没有站点 font-face，实际字形依赖操作系统；跨 Windows / macOS / Android 需要在 T47 核验 |
| public body / 正文与导航 | PingFang SC → Microsoft YaHei → Noto Sans CJK SC → system-ui → sans-serif | 无网络字体等待，正文稳定；导航、表单和数字均继承它 |
| public mono / 标识或技术值 | ui-monospace → SFMono-Regular → Consolas → monospace | 仅用于确有机器可读含义的值，不用于普通标签 |

现有 Noto Serif SC OTF 的 notices 标注用途为委托制作单 PDF 正文；本轮不把它直接改作公开 UI 字体。若要固定 display serif，应先确认视觉样张与资产用途，不因“仓库里已有文件”就擅自启用。

### Type Scale

| 角色 | 规格 | Weight / Tracking | 约束 |
| --- | --- | --- | --- |
| 正文 | 16px / 1.55 | 400 / 0 | UI 与短说明 |
| 编辑正文 | 16px / 1.72 | 400 / 0 | About、Commission 长文 |
| 辅助文字 | 14px / 1.5–1.72 | 400–600 / 0 | 元信息、注释、状态补充 |
| Eyebrow / Label | 12px / 1.5 | 700 / 0.12–0.16em | 仅用于短标签，不承载长句 |
| Navigation | 14px / normal | 400–600 / 0 | hover 不改变 weight 或几何宽度 |
| 页面 H1 | clamp(28px, 3vw, 44px) / 1.18 | 600 / -0.025em | 全站使用 PublicPageIntro 尺度 |
| 模块 H2 | 复用现有 xl / heading 尺度 | 600 / tight | 同级模块不另造字号 |
| Hero 标题 | 现有 clamp(40px, 7vw, 108px) / 1.08 | 固定品牌字面 / 不合成加粗 | 保留 V01 一次性入场；不在换图时重播 |
| 数字 / 价格 / 分页 | 继承正文或对应标签 token | tabular-nums 仅在对齐确有需要时启用 | 不混入 display serif 制造装饰 |

正文每行优先控制在约 30–42 个中文字符；About 与 Commission 的长文使用 reading width，短状态和动作区域不强行套入长文列宽。禁止在单页使用未命名的近似字号或通过 font-weight hover 造成导航抖动。

## C2. Layout and Spacing

- Header 视觉高度保持约 72px。
- 页面水平内边距：
  - 390–430：16px；
  - 768–1023：24px；
  - 1024 及以上：32–72px 流体区间。
- 内容上限继续使用现有 wide 90rem、article 52rem、reading 44rem 体系。
- PageIntro 与同页正文首列必须共享一条主对齐线；如正文居中，标题也进入同一编辑网格，不采用“标题贴左、正文居中”的偶然组合。
- 页面主段落间距使用现有大间距节奏，卡内间距使用中小节奏；不要通过新增任意像素补丁修正单一视口。
- 所有按钮、输入框、菜单和 Footer 移动链接的交互盒最小为 44 × 44px。

## C3. Surface, Border and Radius

- 公共页面继续以白色 primary surface 为底；secondary #f7f8fa 与 tertiary / image placeholder #f1f3f6 只用于区分媒体画布、轻状态和内容层级。
- UI 保持黑、白、灰为主。现有 #324daf 仅用于链接、主行动、焦点和少量状态，不扩成大面积蓝色背景或渐变。
- 默认结构边框使用 primary #dde1e7；弱分隔使用 secondary #eceef2；焦点边框使用 #324daf。
- 普通卡片不新增浮夸阴影。仅下拉、覆盖层或确需悬浮层级的组件使用现有 raised / overlay shadow。
- 图片保持 12px；输入与普通矩形控件优先 8px；容器按现有 12 / 16px 层级；胶囊按钮与圆形控件使用 full radius。
- 同一交互组件在 default / hover / focus / active 时不得改变边框宽度、padding 或几何尺寸。
- 角色设定图的 contain 画布优先使用 tertiary / placeholder surface，不增加纹理、渐变或角色化装饰。

## C4. Featured Works

### 单项

- 390–430：媒体占可用宽度，最大约 22.5rem，保持 3:4；说明与媒体左边对齐。
- 768–1023：使用独立的单项媒体 / 说明构图，可采用约 3:2 或 60/40 关系；不得保留一个不可见的第二媒体列。
- 1024 及以上：媒体宽度控制在 320–360px、比例 3:4；媒体与说明形成紧密组团，不让说明漂到场景最右端。

### 双项

- 保持两张 3:4 媒体的并列关系。
- 1440 像素下媒体间距建议约 48–56px；较窄宽度使用流体间距。
- 文案与两张媒体整体共同居中，而不是以空列补齐。

## C5. Image Treatment

- 通用图片圆角保持 12px。
- 摄影型 Hero / Commission 可继续 cover，并通过现有焦点元数据或派生图保证主体。
- 角色设定图和需要完整阅读的横版图使用 contain：
  - 画布比例优先跟随派生图或允许的比例范围；
  - 画布使用低对比中性色，不增加装饰纹理；
  - max-height 必须为标题、身份、状态和动作保留一屏空间；
  - 不再跨 390、430、1024、1440 使用同一个固定高度。
- Works 卡片继续尊重真实媒体比例；caption、身份和状态间距保持一致，不通过裁切把所有素材伪装成同一比例。
- 水印仅在确认后调整。建议讨论基线：最长不超过图片短边约 32–36%，透明度约 14–20%，避免覆盖脸和眼睛，并避免再生成第二个应用水印。

## C6. Components

### Header / Navigation

- 保持当前桌面 / 移动结构、圆角和焦点返回逻辑。
- 下拉、移动抽屉和按钮统一使用现有描边与圆角 token。
- 不增加纯装饰动画或 hover-only 信息。

### Footer

- 保持品牌、导航、联系方式、法务 / 备案的现有顺序。
- 移动端把行内链接包装成至少 44px 高的可点击项，可两列或自动换行，但法务区仍在最底部。
- 不添加 Footer 入场动画。

### Contact Cards

- 两个渠道在移动端可保持两列；极窄内容状态允许一列。
- 桌面卡片最小约 10.5rem、最大约 14rem；QR 图约 8–10rem。
- 使用 auto-fit / max-content 控制，不把两个卡片平均拉满 44rem 阅读栏。
- 平台名、二维码和号码的顺序保持一致。

### Public Action / Search / Form

- 主次按钮延续当前层级，最小高度 44px。
- 搜索框与相邻动作在移动端允许换行，不能压缩可读宽度。
- Apply 的 PageIntro 和 46rem 表单列共享对齐线。
- 空字段不常驻 1.25em 错误高度；错误出现时通过局部最小高度、摘要或稳定网格避免显著 CLS。

## C7. Icon and Button

### Icon

- 当前没有公共 icon package；继续优先使用仓库内小型内联 SVG / CSS。
- 方向、关闭、播放 / 暂停使用一致的 18–22px viewBox 体系、round linecap / linejoin 和约 1.75–2px 线宽。
- 分页 ‹ / ›、详情 ←、外链 ↗ 不再依赖系统字体字符来决定几何；可抽取现有 SVG，但不为此新增依赖。
- 图标按钮必须有可访问名称；纯装饰图标保持 aria-hidden。
- Icon 不单独承担状态，必须与文字、aria-label 或可辨认的控件上下文配合。

### Button

- PublicAction 主按钮：44px 最小高度、pill radius、600 weight；primary 使用 accent，secondary 使用白底 + primary border，text variant 不伪装成实心按钮。
- hover 只在可 hover 设备表达颜色 / 边框变化；active 可使用 1px 下压和 0.99 scale。
- focus-visible 使用现有 3px focus ring 和 2px offset，不能被 hover 或 active 覆盖。
- loading 保留 aria-busy 和不可重复触发；spinner 的 loop 时长需归入明确 token，reduced-motion 下停止旋转。
- disabled 不只变色，还保持 disabled / aria-disabled 语义和不可操作状态。

## C8. Motion

继续使用现有语义时长：

- feedback：120ms；
- state：180ms；
- content：420ms；
- media：720ms；
- standard easing：cubic-bezier(0.22, 1, 0.36, 1)；
- playful easing：cubic-bezier(0.2, 1.16, 0.32, 1)。

意图映射：

- 键盘 Hero 切换：state 180ms；
- 指针 / 按钮 Hero 切换：content 420ms；
- 自动播放 Hero 切换：media 720ms；
- 卡片 fine-pointer hover：1.02–1.025 倍，旋转不超过 0.35deg；
- reduced motion：只保留 120–180ms 的透明度 / 颜色反馈，停止自动播放与大幅位移。

新增 delay、spinner-loop、wheel-lock token 时，应说明其语义，不用仅为消灭数字而把所有持续时间强制成同一档。滚轮锁必须与实际场景过渡完成一致。

### 当前公共动效因果矩阵

| 动效 | 为什么需要 / 表达什么 | 中断与反向 | Touch | Keyboard | Reduced motion | 持续噪声判断 |
| --- | --- | --- | --- | --- | --- | --- |
| Hero 自动轮播 | 表达同一 Hero 集合的内容轮换，而非页面状态变化 | 点击、键盘和暂停可覆盖下一次自动意图；上一张 / 下一张可反向；快速输入已验证最终状态稳定 | 离散 swipe，保留 pan-y；触摸后控件暂时显露 | 焦点进入后控件可见，左右箭头使用 180ms opacity 切换 | 停止 autoplay，去除位移，只留短 opacity | 唯一持续变化项；10 秒一次且可暂停，当前可接受 |
| Hero 控件显隐 | 表达用户已靠近或正在操作，不在静止时占据画面 | 新输入重置显隐计时；paused 状态覆盖自动隐藏 | 点击 / 触摸后显示约 4 秒 | focus-within 时持续显示 | 只淡化，不缩放；暂停控件在 reduced 下隐藏 | 事件触发，不持续 |
| Featured / Work / Adoption 图片 hover | 表达媒体可进入，提供轻微“生命感” | pointerout 自然反向；CSS transition 可被新状态打断 | 不启用 | 信息与导航不依赖 transform；focus 另有 ring | transform 和 transition 取消 | 仅 fine pointer 交互时出现 |
| PublicAction 状态反馈 | 表达 hover、active、disabled、loading 的即时因果 | hover / active 可立即反向；loading 由业务状态结束 | active 仅轻微下压，不要求 hover | focus-visible 独立存在；Enter / Space 语义不变 | 取消 active transform；spinner 停止旋转 | spinner 只在 loading 期间循环 |
| 移动全屏菜单 | 表达导航层打开 / 关闭 | Vue 状态切换可反向；关闭后恢复页面与焦点 | 菜单按钮、关闭按钮和链接正常触控 | 首焦点进入关闭按钮，Tab 留在层内，Escape 关闭并归还焦点 | 只保留 180ms opacity | 只在开关时出现 |
| 桌面首页 wheel scene | 表达 1024px+ 画册式逐幕换页 | 620ms lock 内同向输入忽略，反向输入返回上一目标；可反向但 lock 数值需 token 化 | 不接管；1023px 以下原生滚动 | 不接管键盘，保持浏览器原生滚动语义 | scrollIntoView 使用 auto，取消 smooth lock | 用户滚轮触发，不自动运行 |
| 首页委托 / 领养进入 | 帮助摄影、标题和动作建立一次性阅读顺序 | 离开页面会 cancel；观察触发后不重复，也不设计反向 | 与可见性相同，不需要手势 | 内容 SSR 默认可见，键盘不等待动画 | 只允许短 opacity / 无大距离 transform | 每段最多一次，不持续 |
| Gallery 图片切换 | 表达当前选中媒体发生变化 | 新缩略图选择可替换当前状态；淡出 / 淡入不改变图库顺序 | 点击缩略图 | 缩略图可聚焦并激活 | 当前直接取消 fade transition | 仅选择时出现 |
| Route shared object | 表达从首页业务入口到目标内容仍是同一张媒体 | 当前仅首页出站路径启用；普通路由与返回不强求对称，快速重复导航仍需 T47 复核 | 点击入口同样生效 | 键盘激活入口同样生效，目标页完成后焦点转 main | shared group 时长压到 0.01ms | 仅导航瞬间出现 |
| Focus ring | 表达键盘当前位置，是可访问状态而非装饰动画 | 焦点移动时立即更新；无需惯性或回弹 | 触摸不强制显示 focus-visible | 3px ring + 2px offset | 保持即时可见，不应移除 | 不运动，不构成噪声 |

## C9. Route Transition and Shared Object

- Nuxt experimental viewTransition 保持可用，但 app.viewTransition 全局关闭；不得为了“更丰富”改成所有路由统一淡入。
- 全局 middleware 只在两个明确入口启用：
  - 首页委托 → /commission?view=home-commission；
  - 首页领养 → 对应 /works/[slug]?view=home-adoption。
- shared object 名称继续使用 home-commission-media 与 home-adoption-media；时长使用 media 720ms + standard easing。
- 不支持 View Transition API 的浏览器必须直接完成导航，不显示空白、不延迟内容、不阻塞点击。
- 返回 / 前进继续遵循现有 scroll restore；跨路径后焦点移交 main，hash 路由继续尊重 Header offset。
- reduced-motion 下 shared group 近似瞬时（当前 0.01ms），不保留缩放、飞行或长距离位移。
- 不新增页面 curtain、全屏遮罩、随机 wipe 或每页 shared object。是否需要“返回首页”的反向 shared object，保持不实现，除非后续明确确认。

## C10. Responsive Matrix

| 宽度 | 滚动模式 | 核心视觉验收 |
| --- | --- | --- |
| 390 | 原生滚动 | 单项代表作品不缩成半宽；领养角色完整；Footer 触控项 44px；无横向溢出 |
| 430 | 原生滚动 | 同 390，并检查两列 QR 的可读性与角色设定图留白 |
| 768 | 原生滚动 | 单项代表作品形成明确的平板构图；委托与领养内容不过度拉长 |
| 1023 | 原生滚动 | 不误触发分屏；页面不保留空的双列轨道 |
| 1024 | 桌面分屏 | Header 下每场景正确吸附；领养图不因近方形容器严重裁切 |
| 1440 | 桌面分屏 | 首页各场景密度平衡；编辑页标题 / 正文对齐；ContactCard 不被拉伸 |

1023 与 1024 必须作为一对边界用例验证，不能只选择其中一个。

## C11. Accessibility, Input and Reduced Motion

- 保持当前键盘切换、暂停、Escape 关闭和焦点归还。
- 可见焦点不能被 hover 样式覆盖。
- 任何新动效均需在 prefers-reduced-motion 下退化；T47 中补做真实模拟与人工确认。
- 内容在 SSR 初始状态保持可见；不能依赖 JavaScript 入场后才显示正文。
- 状态和价格不能仅靠颜色区分。

## C12. 证据

截图目录：.design/screenshots/visual-audit-2026-08-22/

重点证据：

- home-390x844-mid1.png：单项代表作品在手机上缩成半宽；
- home-430x932-adoption.png：横版角色设定图被固定高 cover 裁切；
- home-1024x900-adoption.png：桌面分屏边界的近方形裁切；
- home-1440x900-featured.png：桌面单项媒体与说明分离、空白过大；
- mobile-nav-390x844-open.png：移动导航全屏、焦点与触控状态；
- about-1440x900-top.png：页面标题与正文横向骨架不一致；
- commission-apply-390x844-confirmations.png：表单后段与确认区节奏；
- work-detail-390x844-gallery.png：详情图库和当前水印强度。

本证据集用于视觉审计，不替代 T47 的真实设备、无障碍偏好与用户主观验收。
