# T26–T27 视觉与管理体验跟进

## 结果

2026-08-04 用户追加的四类调整已完成实现方复核：

- `/works` 与 `/commission` 的 H1 统一复用 `PublicPageIntro`；
- 后台作品列表移除可见“作品列表” caption 和浅色外框，增加角色名/物种查找、用途/装型/发布状态筛选与 10/20/50 客户端分页；
- `/commission` 复用首页第一启用轮播项的横竖双源图作为单张背景，叠加导览文字与制作范围/邮件行动；无图时不伪造占位图；
- 固定文案和委托/领养营业状态迁入 `/admin/site/content` 独立“文案配置”，继续复用既有 API、版本冲突和纯文本校验，未扩展为 CMS。

参考仅取自渔屋的委托首屏、关于页信息节奏和服务约定分组；没有复制原文、品牌事实或法律文本。OQ-120 原创候选稿只登记在 `requirements/SPEC.md` §6.7，未写入数据库。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm exec vitest run tests/unit/admin-work-list.test.ts` | 1 文件 / 2 用例 PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS，含生产内容守卫 |
| `tests/e2e/admin.spec.ts` 定向用例 | 五入口、列表真实内容、查找/筛选/分页 PASS |
| `tests/e2e/t26-t27-visual-follow-up.spec.ts` | 2 / 2 PASS |

Playwright 使用真实 Chrome 和独立临时 SQLite；公开端使用 `127.0.0.1`，管理端使用 `localhost`。实测确认：H1 计算 `font-size` / `line-height` 一致，委托横竖图可解码，两个行动链接正确，390×844 / 768×1024 / 1440×900 无横向溢出。首轮 E2E 暴露的两个失败均为新增重复文字导致测试定位不唯一，收紧到具体行/精确标题后复跑通过。

## 视觉证据

`implementation/notes/t26-t27/screenshots/`：

- `visual-follow-up-commission-390x844.png`
- `visual-follow-up-commission-768x1024.png`
- `visual-follow-up-commission-1440x900.png`
- `visual-follow-up-admin-works-search-1440x900.png`
- `visual-follow-up-admin-content-1440x900.png`

人工视觉复核后又修正了 1440 视口下“从角色设定出发”最后一字孤立换行，最终截图已覆盖为修正后版本。

## 门禁

本记录是实现方自测，**不是独立 Review**。T26/T27 继续未勾选；下一步仍是用户确认 OQ-120、在“文案配置”录入正式文案、新上下文独立 Review，最后由用户验收。
