# T47-F2 Handoff · Commission / Contact Polish

## Completed

- 委托估价说明替换为用户确认的短文案，字号缩小并与联系目录等宽。
- About 只保留 story 与 Contact 之间的分割线；联系目录只保留外轮廓。
- 管理端委托营业状态卡改为全宽。
- 0049 前向迁移只替换空值或精确旧默认；`CLAUDE.md`、COPY、design、TASKS 和 STATE 已同步。

## Locked Decisions

- 不新增组件、字段、依赖或交互；只修改现有 scoped CSS 和默认文案。
- QQ 直达、hover/focus 二维码、触控退化和复制邮箱浮层保持不变。

## Open Issues

- 真实 iOS/Android 和最终人工观感仍属于 GATE-E。

## Regression Risks

- 如管理员已自定义估价文案，0049 不会覆盖；需人工在后台选择是否同步新文案。

## Validation

- `pnpm check:fast`：54 files / 319 tests 通过。
- `pnpm test:smoke`：11/11 通过。
- `pnpm build`：Nuxt client/SSR/Nitro 与 production content guard 通过。
- 1728px/390px 浏览器实测：委托文案 24px/18px 且与联系卡等宽；About 只剩一条目标分割线；联系行内边框均为 0，无水平溢出或 console error。
- 本地 `.data/dev.db` 已迁移到 50 条，自动备份已创建，`integrity_check=ok`、`foreign_key_check=[]`。

## Next Task

- 用户在当前本地数据上复核 `/commission`、`/about` 与 `/admin/site/content`。

## Do Not Start Yet

- 不自动启动部署、生产迁移或 GATE-E 代签。
