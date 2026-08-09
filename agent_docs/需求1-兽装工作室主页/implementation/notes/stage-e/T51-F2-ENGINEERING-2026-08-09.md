# T51-F2 工程记录（2026-08-09）

## 结论

`/works` 与 `/adoptions` 的公开列表分页已经完成：作品固定每页 12 件，领养固定每页 8 个，访客不选择每页数量。分页发生在筛选之后，继续按发布时间倒序；两个列表共用同一个公开编号分页组件。

当前筛选只要有结果，即使只有一页也固定显示分页栏。单页时显示禁用的上一页、品牌蓝当前第 1 页和禁用的下一页，避免因本地数据不足一页而误以为分页功能缺失。

## 实施范围

- 公开作品与领养查询增加 `page`，DTO 返回 `page`、`pageSize`、`pageCount`、筛选后的 `resultCount`；
- repository 在用途、装型或领养方式筛选后执行分页，真实仓储与 fake 仓储保持同一契约；
- 第一页链接省略 `page`，分页保留筛选，筛选入口回到第一页；非法页码收敛到第一页，越界页显示受控空态；
- 公开分页使用普通链接，支持 SSR、重载、无 JavaScript、键盘焦点与屏幕阅读；手机端收紧页码但保留 44px 以上触控目标；
- 用户已经删除的 `/adoptions` 计数文案保持删除，没有恢复；对应遗留样式和旧断言一并清理；
- 没有数据库迁移，也没有改变公开媒体或私有数据边界。

## 验证

- `pnpm lint`：通过；
- `pnpm typecheck`：通过；
- `pnpm exec vitest run tests/unit/public-pagination.test.ts`：1 个文件、2 个测试通过；
- `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/public-site-contracts.test.ts tests/integration/public-site-pagination.test.ts`：实际匹配 1 个文件、6 个测试通过；
- 本轮此前的作品/领养浏览器套件运行到 27/28，通过的场景包含作品多页编号、筛选保留、键盘、三视口、非法/越界页码和领养多页编号；唯一失败是旧用例仍断言用户已删除的领养计数文案。断言已改为验证单页分页栏；后续两次隔离 E2E 启动器被外层等待上限终止，未取得可声明为全绿的新套件结果；
- 对当前开发服务 `http://127.0.0.1:3000` 做真实浏览器复验：`/works` 与 `/adoptions` 在 `390×844`、`768×1024`、`1440×900` 下分页栏均可见，当前页为 1、两端各有一个禁用控件、无横向溢出、图片全部解码；控制台 0 error / 0 warning；
- 当前真实 API 返回：作品 `pageSize=12`、领养 `pageSize=8`，两页均有完整分页元数据；SSR 同时直出对应分页导航，领养计数文案不存在。

## 边界

这是实现自测与本地浏览器证据，不代签 T49 新上下文独立 Review，也不代表 GitHub Actions 已全绿。
