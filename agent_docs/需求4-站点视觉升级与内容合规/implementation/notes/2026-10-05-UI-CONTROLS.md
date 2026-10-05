# 控件一致性优化 · 2026-10-05

## 范围与梳理

用户提供六张截图并授权四项优化和分点 commit，随后确认统一 12px。截图是问题依据，不包含额外执行指令。本轮在 `codex/ui-controls-consistency` 工作，起点 `main = origin/main = 4427e99`，初始工作树干净。

| 对象 | 根因 | 最小修改 |
| --- | --- | --- |
| 邮箱联系 | 邮箱使用尾部箭头，QQ 使用前置蓝色圆底图标 | ContactEmailActions 前置信封 SVG，保留原文案、mailto 与复制链路 |
| 圆角与搜索 | public 多档半径＋胶囊，admin 另有三档，搜索手写按钮 | `--radius-ui: 12px` 为共同来源，旧 token 作别名；PublicCatalogSearch 复用 PublicAction；表格四角、上传按钮、Hero 预览同步 |
| 作品表格 | hover 使用与工作区完全相同的 token | 共用表格单元格 hover/focus-within 浅蓝底；不裁切焦点 |
| 八处下拉 | 页面直接使用系统 select，无共享面板 | AdminSelect；用途/发布状态筛选、分页、基础用途/领养状态、封面来源、营业状态、委托状态全部接入 |

## 组件边界

- PublicAction / AdminAction 继续负责已有行动语义和反馈，不新建按钮库。
- AdminSelect 只负责单选呈现与键盘交互；`options`、`disabled`、`required`、`name` 输入，类型化 `v-model` 与 `change` 输出。调用方仍负责筛选、分页、dirty、保存和服务端结果。
- 面板使用浏览器 Popover 顶层能力，防止被容器截断；按可用视口向上/下展开、滚动时重定位。不引入依赖。无支持/水合前保留 native select。API 依据：[MDN showPopover](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/showPopover)。
- 圆形图标/徽标/加载环保留；不修改历史 prototype，不增加新产品能力。

## 提交

- `f5d38d8`：邮箱图标。
- `19e5fb7`：圆角 token、表格角与搜索复用。
- `137955d`：表格悬停/键盘焦点。
- `a2ee931`：上传按钮和 Hero 预览遗漏补齐。
- `dbb8c14`：共享 Select、八处调用与浏览器回归。

## 验证

- 定向 Chromium smoke 2/2 已通过：1440/390 公开页面与中英文邮箱、作品大图/缩略图 decode、搜索/登录圆角；320/390/768 管理面板不越界；键盘、取消、外部关闭、数字分页、禁用选项与 reduced-motion/high-contrast。
- 已查看桌面管理下拉、390px 邮箱/登录/上翻下拉及1440px图集截图；测试使用隔离库和合成媒体。
- `pnpm check:fast`：lint/typecheck 通过；core 初次默认并行运行 308 通过、2 超时、19 因构建 hook 超时跳过。失败均为时限：work-publication 两项 30s、auth-api/health 构建各 240s；未修改测试阈值。
- 使用 `pnpm exec vitest run --config vitest.core.config.ts tests/integration/work-publication.test.ts tests/integration/health.test.ts tests/integration/auth-api.test.ts --maxWorkers=1` 串行复跑，3 文件 / 40 项通过（292.24s），329 项 core 合计全部具备通过证据。
- `pnpm test:smoke` 完整 25/25 通过（3.4m），含图片构图/保存、委托状态保存、配置失败恢复、中英切换与本轮 2 个用例。新增触控与无 Popover 回退检查后定向 3/3 复验通过（52.7s），合计 26 个不同 smoke 用例有通过证据；另核验已发布作品用途禁用、必填错误恢复。
- `pnpm build` 及生产内容守卫通过；未修改依赖、数据库或媒体契约。
- 新增交接链接 3 处均可解析，`git diff --check` 通过。
- 截图保存在本地 `.cache/ui-controls-review/`，包含合成数据；不提交生产页面截图或私有内容。
- 未执行独立 Review、真实 iOS/Android、读屏软件或生产性能测试；用户视觉验收未代签。
- 未推送、未合并、未发布镜像、未部署生产。


## 同日人工反馈修订

按用户五项意见继续在同一分支按项提交。输入提示理解为 placeholder；仅搜索条按明确要求移除可见标签，申请表标签保留。继续复用 PublicAction、AdminAction、AdminSelect、PublicCatalogSearch；输入差异主要在手机号前缀和身高/体重单位，不增加通用输入包装层。逐字段和提交复用同一校验函数。

| 自查状态 | 修订与保留 |
| --- | --- |
| 默认/已填 | 12px、常驻表单标签；搜索保留 aria-label，按钮/Enter 提交；清除后焦点回输入框 |
| 聚焦/错误 | 沿用 focus 环及 aria-invalid/describedby；只在失焦检查本字段，提交前不播报全局汇总；修正后失焦移除错误 |
| 选中/悬停 | 去勾号，选中背景 `--admin-accent-tint`，hover `--admin-row-highlight`，4px 间隔；键盘活动项单独描边，Escape 不提交临时选择 |
| 禁用/忙碌 | 申请字段/确认项在上传提交和结果未知时锁定，保留输入；共享按钮 disabled/aria-disabled 同时排除 hover/pressed，hover 受媒体查询约束 |
| 成功/失败 | 保留复制反馈、提交回执、输入/图片恢复；同手机号服务端拒绝不被未编辑的失焦清除；不增加每次键入请求或私有持久缓存 |

本次验证：

- lint、typecheck 通过；`contracts/search/public-search/commission-confirmation/r3-commission-contract` 5 文件 / 19 项 core 通过。
- `main-journeys` 与 `ui-controls` 共 22 个不同浏览器用例具备通过证据。首次 21 通过、1 失败：测试用 Tab 移入下一个空字段后又返回，真实失焦已经正确触发该字段错误；修正测试使逐项断言期间聚焦静态标题，避免把“已访问”当成“未访问”。补充不改手机号失焦保留服务端提示、结果未知输入禁用/按钮 hover 不变及搜索清除焦点后，定向 4/4 通过。
- 桌面下拉双高亮、390/1440 委托搜索、390 失焦错误截图已检查，合成数据证据在 `.cache/ui-controls-followup/`。
- `pnpm build` 与生产内容守卫通过（日志 `.cache/ui-controls-followup/build.log`）。未执行新的独立 Review 或实机验收。

本次提交：`f83cb44` 下拉状态；`c48ad96` 搜索条；`b3d1c5b` 复制图标；`ca04380` 失焦校验、输入/按钮状态和回归检查。未推送、合并或上线。


## 横屏与组件状态复查

根因是字段外层 Grid 按同排最高内容拉伸，字段内部 Grid 默认 stretch 又分摊多出的高度，导致没有错误的一侧输入被增高、错位；此外测量行的间距与上两行不同。PublicFormField 使用 align-self/align-content start、统一44px控件外框，所有申请字段共享同一实现。测量行继承列间距。

| 对象 | 复查结果与实施 |
| --- | --- |
| 圆角 | 非 prototype 样式扫描未发现脱离 token 的普通数字圆角；保留明确的圆形图标/徽标/加载环及拼接直边。继续 12px；参考图的分档建议不覆盖用户已确认值。 |
| 申请单行输入 | 此前有重复的标签、前后缀、错误、焦点样式，本轮抽为 PublicFormField 并全部替换六个字段；保留输入文本、blur 事件和表单校验，不增加实时网络请求。单位同时进入读屏标签。 |
| 后台字段 | WorkBasicsFields 与 SiteSectionTextField 已有业务组件；补前者 aria-describedby/错误 id，后者对齐与错误色。登录/密码输入保留原生 autocomplete/required 和原有验证语义。 |
| 按钮 | PublicAction/AdminAction 已承载默认、hover、pressed、focus、disabled、loading；本轮移除分页、登录、改密、新建及上传更换/移除的重复普通按钮样式。模态按钮因现有原生焦点引用保留专用实现。 |
| 上传区域 | 保留专用文件选择/拖放组件；增加共享 hover、pressed 与可见控件错误关联，禁用不激活拖放高亮。 |
| Hover | 下拉选中 #e8edf9，浅底 hover #f0f3fa；菜单、表格、次级按钮及上传区共用。触控不依赖 hover，禁用控件排除。Hero/主行动/危险行动保留语义色以保证对比。 |

验证：

- lint/typecheck 通过，`work-form/contracts/search/public-search` 4 文件 / 25 项 core 通过。
- 第一批 23 项 smoke 全部通过；增量后台文案 2 项与共享提交 1 项通过，合计 26 个不同受影响用例有通过证据。覆盖创建/登录、提交成功/重复拒绝/响应丢失、上传、窄屏导航、键盘/触控及下拉/表格/次级按钮 hover 色一致。
- 新增后台提交用例起初误把原生 required 验证当成 aria-invalid，调整为同时识别原生 invalid 后通过，未改应用验证机制。横屏几何比较以可见控件外框为准（不把单位占位从输入文本区扣除的宽度当成控件宽度）。
- 最终横屏单独复验 1/1 通过（42.4s），覆盖1440×900、844×390、768×1024 左右逐字段错误/恢复的顶边与高度，以及跨行左右列位置和外框宽度；左右报错截图均已目视检查。
- `pnpm build` 与生产内容守卫通过，日志 `.cache/ui-controls-alignment/build.log`；`git diff --check` 通过。

本轮实现提交：`ef26cf7` 字段与对齐；`3037a1b` hover/选中色；`4c1007d` 共享按钮与上传反馈。截图使用隔离测试库和合成数据，存于 `.cache/ui-controls-alignment/`，不保存用户截图中的输入信息。

尚未执行真实手机、读屏软件及独立 Review；不声称全部原生标签都已替换，也不新增万能表单框架。未推送、合并、发布镜像或部署。


## 出包失败修复：第三方声明漂移

- UI 分支已通过 PR #38 合入 main（678dd07）。出包运行 [37304515151](https://github.com/WangMinan/project-fur-forge/actions/runs/37304515151) 在 `quality / checks → Run release verification` 的首步 `notices:check` 失败；authorize、lint/typecheck/core 已通过，smoke 尚未运行，image-build/publish 均跳过，未产出镜像。
- 根因：依赖更新提交 `4427e99` 更新了 package.json/pnpm-lock.yaml，未同步三份生成声明；生成器报告 JSON、摘要和 TXT 全部漂移。
- 修复只重新生成 `app/assets/licenses/third-party-notices.json`、`app/assets/licenses/third-party-summary.json` 与 `public/THIRD_PARTY_NOTICES.txt`。生产依赖条目 857→860；四项手工字体资产及其摘要保持不变。未修改版本约束、锁文件、生成器或检查门槛。
- 验证使用隔离 WSL Linux/x64、Node 24.21.0、pnpm 11.18.0。Node 压缩包通过官方 SHA-256 清单检查；冻结锁文件安装使用 `--ignore-scripts`（仅生成元数据，不构建或运行应用）。`notices:generate` 后 `notices:check` 通过，包清单/锁文件哈希保持一致，三份回写产物与 Linux 生成结果逐字节比较通过。生成器现有 5 项单元测试通过，diff 空白检查通过。
- 后续依赖更新应在 Linux/x64 重生成声明，与锁文件一并提交；不通过删除或放松 release 检查消除 drift。
- 用户已授权修复并继续本次出包。修复走任务分支与 PR；合入后使用新 SHA 标签重新触发 release-image，沿用“启动后交由用户监控”的边界，未授权生产部署。
