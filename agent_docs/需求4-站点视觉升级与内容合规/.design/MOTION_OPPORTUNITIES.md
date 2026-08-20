# 阶段 E · T37 动效机会审计

> 日期：2026-08-21  
> 基线：PR #21 `codex/r4-t04-t21-foundation@2920214`  
> 范围：只读检查当前公开端 reveal、hover、carousel、route、menu、状态反馈与三条共享对象路径；本文件不修改应用代码，也不引入动效依赖。  
> 判定：每项依次通过频率、目的、速度和功能门禁；精确值沿用需求4已锁定的未来 token（feedback 120ms、state 180ms、content 420ms、media 720ms、standard `cubic-bezier(.22, 1, .36, 1)`、playful `cubic-bezier(.2, 1.16, .32, 1)`），由 T41 统一落地。

## 侦察结论

- 技术栈是 Nuxt 4 + Vue 3；当前无 Motion/GSAP 等动效依赖，普通场景继续使用 CSS/WAAPI。
- `HomeMotionReveal.vue` 对 Hero 后三幕统一执行 620ms 上浮；`app.vue` 与 `public-base.css` 对全部公开路由执行 `out-in` + 250ms 位移；两者与阶段 E 契约冲突。
- Hero 当前把 autoplay、点击、键盘与 pointer-up swipe 共用 680ms 位移/缩放；控制器常驻。10 秒轮播、页面隐藏暂停和 reduced-motion 停止的业务基线已经成立。
- `WorkCard`、`AdoptionCard` 与首页委托卡已有 fine-pointer scale/上移，但没有只突出 lead work 的层级；委托仍是 21:9 描边业务卡，领养仍复用目录卡。
- 移动菜单有完整焦点循环、Escape、背景 inert 和焦点归还；只需收敛视觉路径，不改可访问状态机。
- 三条共享对象路径尚未设置 View Transition 名称；普通路由不需要共享对象或纵向入场。

## 通过门禁的机会

| # | 位置与现状 | 门禁结论 | 建议动效 | 输入模态、reduced 与中断 |
| --- | --- | --- | --- | --- |
| 1 | `HomeHeroCarousel.vue:217-252, 343-480`：首图与品牌文字同一批上浮，缺少 mask/clip 层次 | 首访/每次进首页；**解释 + 愉悦**；营销场景允许长于普通 UI；只移动唯一主媒体 | 首图 `scale(.99) → 1`，media 720ms standard；英文/中文/slogan 用 `clip-path` + 12px，content 420ms standard，80ms/100ms 错峰 | autoplay/直接进入使用完整时序；reduced 只保留 state 180ms opacity；WAAPI/CSS animation 在路由离开时取消，不锁输入 |
| 2 | `HomeHeroCarousel.vue:47-149, 254-303`：所有切换共用 680ms，控制器常驻 | 每 10 秒自动、偶尔显式切换；**状态指示 + 防止突变**；媒体预算内；轮播是当前视口唯一主对象 | autoplay 使用 media 720ms 的 2% 横向 + `scale(1.01)` crossfade；pointer/touch 使用 content 420ms；keyboard 使用 state 180ms opacity；分页状态 state 180ms，显式控制只用 feedback 120ms playful | focus-within/fine pointer 边缘/控制区/触控点击唤起；暂停后恢复入口常显；再次切换由 Vue transition 从当前呈现值重定向；reduced 停止 autoplay、无位移，仅短淡化；不实现 drag |
| 3 | `FeaturedWorks.vue:17-34`、`FeaturedTrack.vue:75-118`、`WorkCard.vue:49-105`：精选全部同权，hover 也同权 | 首页偶尔浏览；**反馈 + 阅读层级**；hover 属 tens/day，仅允许轻量；只让 lead 成为主对象 | lead 媒体进入使用 12px + `scale(.99)`、content 420ms standard；caption 延后 80ms；fine pointer hover 上移 3px、图片 `scale(1.025)`、最多 `rotate(.35deg)`，content 420ms；次级轨道只保留 feedback 120ms 按压/边界反馈 | hover 仅 `hover:hover` + `pointer:fine`；touch 无 tilt、只按压；keyboard 导航即时；reduced 去掉位移/旋转/缩放并保留 opacity/color；重复 hover 用 CSS transition 可反向 |
| 4 | `HomeBusinessEntries.vue:20-80, 108-171`：完整委托幕仍是 21:9 描边卡，图片与文字没有空间交接 | 每次首页一次；**解释 + 阅读进程**；营销 content 预算；不与 Hero 同视口竞争 | 静态非对称分栏成立后，图片以 16px + `scale(.99)`、content 420ms standard 进入，文字延后 90ms 仅 opacity/8px；行动只做既有 feedback 120ms | 专用 IntersectionObserver + WAAPI 只在首次进入触发，初始 DOM/CSS 始终可见；无 JS 直接静态；reduced 只做 state 180ms opacity；离开路由或重触发先 cancel 当前 animation |
| 5 | `HomeCurrentAdoptions.vue:16-34`、`AdoptionCard.vue:18-53`：目录卡被放大为首页收尾，caption 与行动可能落到下一屏 | 每次首页一次；**解释 + 防止突变**；单幅角色是该视口唯一主对象 | 静态一屏海报成立后，媒体 `clip-path: inset(0 0 8% 0)` + `scale(.99)` 到完整画面，media 720ms standard；caption 使用 content 420ms opacity/8px，延后 100ms；不加 tilt/循环 | 仅首次进入；无 JS 静态可见；reduced 去掉 clip/位移/缩放，只保留 state 180ms opacity；WAAPI 可取消；caption/行动不覆盖主体 |
| 6 | `PublicMobileNav.vue:38-109, 225-259`：面板从顶部整体位移，项目逐项 keyframe；状态机已完整 | 移动端偶尔；**空间一致性 + 状态指示**；普通面板预算内；不移动阅读中的数据 | 面板从菜单按钮所在上缘以 4px + opacity 进入/退出，state 180ms standard；项目不再逐项纵向飞入，只用 40ms opacity 错峰，最多覆盖首屏项目 | touch/keyboard 同一即时打开状态，视觉不延迟焦点；reduced 只保留 state 180ms opacity；关闭沿原路，快速开关由 transition 重定向；保留 inert/Escape/焦点归还 |
| 7 | 首页代表作品、首页委托、首页领养到目标详情：当前只做全站 page transition | 偶尔；**空间一致性**；渐进增强且不阻塞导航；只增强确认的三个对象 | 使用原生 View Transitions；共享媒体只做 media 720ms standard 的轻 crossfade/scale，普通路由改为最多 state 180ms opacity，不带纵向位移 | 仅支持 API、非 reduced、非后退/错误时启用；每次点击只注册一个唯一名称并在结束清理；不支持时原生导航；reduced 禁用共享对象飞行 |

## 拒绝清单

- `HomeMotionReveal.vue` 与 `index.vue:40-56` 的三幕通用上浮。**拒绝：功能门禁失败。** 它让所有章节拥有同一运动语义，并会在真实滚动/全页截图中制造等待态空白；T38 退役。
- `app.vue:10-14` 与 `public-base.css:217-248` 的全站 `out-in + translateY`。**拒绝：频率与功能门禁失败。** 导航是高频功能行为，不应等待旧页离场；普通路由只允许即时或短 opacity。
- 所有作品卡、领养卡和委托卡统一 tilt/阴影。**拒绝：频率与功能门禁失败。** 次级目录内容是要阅读和操作的数据，只有首页 lead 的 fine-pointer 聚焦通过。
- 所有 CTA 统一回弹。**拒绝：频率门禁失败。** 公开行动保持 120ms 即时 press；playful 只留给 Hero 控制器和少量状态反馈。
- Footer 整体入场。**拒绝：目的门禁失败。** Footer 通过排版收尾，没有需要解释的状态或空间来源。
- 当前 Hero 的 pointer-down/pointer-up 位移阈值升级为“拖拽”。**拒绝：功能门禁失败。** 现有实现没有 1:1 跟手、pointer capture、反向、中断、速度交接与纵向滚动仲裁；阶段 E 继续离散切换。
- 键盘方向键使用完整 720ms 媒体动画。**拒绝：频率与响应门禁失败。** 键盘命令即时生效，只允许 180ms 短淡化。

## T38～T47 交接

- T38 先删除通用 reveal 与全站纵向 page transition，并让四幕静态层级、空态和五个目标视口成立。
- T41 只为上表通过的机会建立 token；不为拒绝项保留兼容 token，也不增加动效依赖。
- T42～T46 逐项实施 #1～#7；每项必须同时落 reduced、输入模态和中断清理。
- T47 用浏览器实画面检查路径、焦点、无 JS、prefers-*、LCP/CLS/decode/GPU；自动测试只保护状态，不断言精确毫秒或像素审美。
