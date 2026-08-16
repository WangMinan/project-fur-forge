# 2026-08-17 首页与目录展示复核

## 1. 用户纠正后的产品边界

- adopted 作品只从首页“设定领养”排除，仍可按 `featured` 出现在“精选作品”。
- 首页、`/works`、`/adoptions` 统一显示“名称 · 物种”，点号两侧保留真实空格，名称字体与字号复用同一组件。
- `/adoptions` 的“可领养”保持绿色，“已领养”改用非绿色中性色，两者都保留文字状态。
- `/admin/site/home` 不向业务用户显示 `collection vN`；四集合的独立 version/CAS 协议继续保留在接口与持久层。
- “新增大图项”复用后台全局主要按钮样式。

## 2. 实现范围

- `public-site-repository` 与 fake repository 的首页精选不再按 adoption status 过滤；首页领养投影继续只取 available。
- `WorkCard` 与 `AdoptionCard` 复用 `WorkIdentityLabel`，并显式导入组件以保证 SSR 与 hydration 一致。
- 领养状态颜色按 `data-status` 区分；adopted 使用 `--public-status-neutral`。
- 大图后台只隐藏业务界面的技术版本文案，不删除 collection version、409 或 FLIP 行为。

## 3. 验证结果

| 命令或检查 | 结果 |
| --- | --- |
| `$env:APP_ENV='test'; pnpm lint` | PASS |
| `$env:APP_ENV='test'; pnpm typecheck` | PASS |
| `$env:APP_ENV='test'; pnpm test` | PASS，38 files / 186 tests |
| focused adoption projection integration | PASS，1 file / 3 tests |
| 四个相关 Chromium spec | PASS，63/63；首轮新增首页断言因 strict locator 同时命中两张卡而失败，收紧到目标 slug 后单条与整组复跑均通过 |
| `$env:APP_ENV='production'; pnpm build` | PASS，production build 与 content guard |
| `pnpm run verify:production` | PASS，health、public SSR、admin CSR |
| 实际本地数据浏览器检查 | PASS：首页精选为“小狗 · 狗”“小绿狗 · 狗”，首页领养只含“小绿狗 · 狗”；三页名称均为 18px 同一字体栈；可领养绿色、已领养灰色；390/768/1023/1024/1440 无横向溢出，控制台无错误 |

验证只使用本地开发站、临时数据库、合成媒体和测试对象存储，不连接生产数据库、OSS、ESA 或真实用户数据；本地工程验证不代签独立 Review、用户验收或生产发布。
