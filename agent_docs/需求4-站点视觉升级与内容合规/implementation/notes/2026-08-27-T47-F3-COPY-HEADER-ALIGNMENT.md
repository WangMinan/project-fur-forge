# T47-F3 Handoff · Copy / Header Alignment

## Completed

- 独立防诈骗提醒已从 `/about`、管理端文案配置、管理/更新/公开 contact DTO 和服务层读写中退役；0050 清空历史值，数据库列仅作兼容保留。
- 0050 只替换空值或精确仓库默认的委托简介、工作室介绍与制作范围，不覆盖其它管理员自定义文案。
- `/works`、`/adoptions`、`/about` 页名区按 `/adoptions` 统一高度、标题尺度和标题下分割线；About 补齐同款浅色工作室 Logo 水印。`/commission` 未改。
- COPY、SPEC、models、design、TASKS、STATE 与 notes 索引已同步；`CLAUDE.md` 保持稳定入口，没有写入本次动作细节。

## Locked Decisions

- 不新增页名组件；Works/About 直接复用既有 Adoption 数值，避免为三个静态页面增加抽象。
- Works 搜索移到固定页名区下方；About masthead 删除重复的工作室标签、概述和联系跳转。
- 不删除历史数据库列或重写旧迁移。

## Open Issues

- 真实 iOS/Android 与最终观感仍由 GATE-E 人工验收。

## Regression Risks

- 管理员自定义的委托简介、工作室介绍或制作范围不会被 0050 覆盖；如需采用新默认，需在后台手动更新。

## Validation

- `pnpm check:fast`：54 files / 319 tests 通过。
- `pnpm test:smoke`：11/11 通过；现有后台登录 smoke 已覆盖文案配置页无防诈骗入口。
- `pnpm build`：Nuxt client/SSR/Nitro 与 production content guard 通过。
- 1440×900 与 390×844 浏览器实测：三页 header/title bounding box 完全一致，分割线均为 1px；About/Works Logo 同尺寸同位置；无水平溢出或 console error。
- `.data/dev.db` 为 51 条迁移；三项新默认已落库，`contact_anti_scam=NULL`，`integrity_check=ok`、`foreign_key_check=[]`。本地 Nuxt 已恢复到 3000。

## Next Task

- 用户在当前本地数据上复核 `/works`、`/adoptions`、`/about` 与 `/admin/site/content`。

## Do Not Start Yet

- 不自动启动部署、生产迁移或 GATE-E 代签。
