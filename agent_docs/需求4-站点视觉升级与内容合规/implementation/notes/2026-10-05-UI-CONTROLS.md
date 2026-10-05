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
