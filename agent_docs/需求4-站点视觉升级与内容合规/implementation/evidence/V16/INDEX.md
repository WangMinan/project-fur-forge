# V16 Final Evidence Index

日期：2026-08-26

范围：V09 Shared Visual Language、V00-F2 公开面矩阵、V09～V15 Evidence/Handoff 与 V16 fresh review。

状态：V16 自动审计、人工截图复核、文档一致性校准和交接前确认的 Homepage 离场闪帧修复已完成；凌巽已确认并授权 T47。本索引不代签 T47、真实手机或 GATE-E。

## 1. V16 Fresh Evidence

- `audit.json`：375×812、768×1024、1280×800 三档，共 15 个公开状态 × 3 = 45 个页面状态；另含 3 个媒体失败和 3 个 500 状态。
- `.design/screenshots/v16-final-consistency/review-*.png`：51 张 fresh full-page review screenshot。
- `.design/screenshots/v16-final-consistency/contact-sheet-mobile-375.png`：Mobile 总览。
- `.design/screenshots/v16-final-consistency/contact-sheet-tablet-768.png`：Tablet 总览。
- `.design/screenshots/v16-final-consistency/contact-sheet-desktop-1280.png`：Desktop 总览。
- `scripts/capture-v16-evidence.mjs`：可重复证据脚本；验证状态码、主选择器、水平溢出、语义、图片解码、运行时错误、Footer 连续性、Hero 品牌锁、媒体失败和 500。

V16 的 10 项 checks 全部为 `true`。随后用户连续操作确认一项截图矩阵未覆盖的时序缺陷：Homepage 非 Hero scene 离场时 persistent Header 抢先 fixed→sticky，使旧 scene 下推 77px。`transition-regression/` 保存 before/after 和逐帧 audit；修复后旧 scene 位移为 0。除此之外只修复旧文档与当前运行时之间的契约漂移。

## 2. Public Surface Coverage

| Public surface | Primary implementation / evidence | Final consistency evidence |
| --- | --- | --- |
| Homepage / Hero | V01、V12-F、V13、V14、V15 | `review-home-{mobile-375,tablet-768,desktop-1280}.png` |
| Homepage Featured | V09、V12-E-F3/F4、V12-F、V13、V14 | Homepage full-page evidence；V09+ active contract |
| Homepage Commission | V10、V10-F1、V12-F | Homepage full-page evidence |
| Homepage Adoption | V11、V12-E-F2、V12-F、V13、V14 | Homepage full-page evidence；最多三项 `available` |
| `/works` | V06、V12-A、V12-E-F2、V12-G、V14 | `review-works-*`、`review-works-empty-*`、`review-works-no-result-*` |
| `/adoptions` | V06、V11、V12-E-F2、V12-G、V14 | `review-adoptions-*`、`review-adoptions-no-result-*` |
| Unified work/adoption detail | V06-F1、V11、V12-A、V12-G、V14、V15 | `review-work-detail-*`、`review-adoption-detail-*` |
| `/commission` | V07-F1、V10、V10-F1、V12-E-F2、V12-G | `review-commission-*` |
| `/commission/apply` | V08、V12-C、V12-G | `review-commission-apply-*` |
| `/about` + `/contact` target | V07、V12-B、V12-G | `review-about-*` |
| `/service` + `/terms` target | V07-F2、V12-D、V12-G | `review-service-*` |
| `/privacy` | V07-F2、V12-D、V12-G | `review-privacy-*` |
| `/licenses` | V07-F2、V12-D、V12-E-F1、V12-G | `review-licenses-*` |
| 404 / 500 | V08-F1、V12-E、V12-G、V15 | `review-not-found-*`、`review-server-error-*` |
| Media failure | V08-F1、V12-E、V12-E-F2、V12-G | `review-media-failure-*` |

V00-F2 的覆盖来源继续保留在：

- `.design/screenshots/coverage-audit-2026-08-23/`
- `implementation/notes/2026-08-23-PUBLIC-VISUAL-COVERAGE-AUDIT.md`

13 个公开路由文件中的三个重定向继续复用既有终点：`/adoptions/[slug]` → unified work detail、`/contact` → `/about#contact`、`/terms` → `/service`，未创建重复视觉模板。

## 3. Task Evidence and Handoffs

| Task | Evidence | Handoff / review |
| --- | --- | --- |
| V09 | `implementation/evidence/V09/` | `implementation/notes/2026-08-24-V09-HANDOFF.md` |
| V10 | `implementation/evidence/V10/` | `implementation/notes/2026-08-24-V10-HANDOFF.md` |
| V10-F1 | `implementation/evidence/V10-F1/` | `implementation/notes/2026-08-24-V10-F1-HANDOFF.md` |
| V11 | `implementation/evidence/V11/` | `implementation/notes/2026-08-24-V11-HANDOFF.md` |
| V12-A/B/C | `implementation/evidence/V12-A/`、`V12-B/`、`V12-C/` | 对应 `2026-08-25-V12-*-HANDOFF.md` |
| V12-D/E/E-F1/E-F2 | 对应 `implementation/evidence/V12-*/` | 对应 `2026-08-25-V12-*-HANDOFF.md` |
| V12-E-F3/F4 | `.design/screenshots/v12-e-f3-*`、`v12-e-f4-*` | 对应 F3/F4 Handoff |
| V12-F/G | `implementation/evidence/V12-F/`、`V12-G/` | 对应 V12-F/G Handoff |
| V13 | `implementation/evidence/V13/` | `implementation/notes/2026-08-26-V13-HANDOFF.md` |
| V14 | `implementation/evidence/V14/` | `implementation/notes/2026-08-26-V14-HANDOFF.md` |
| V15 | `implementation/evidence/V15/`、`.design/screenshots/v15-final-review/` | `implementation/notes/2026-08-26-V15-HANDOFF.md` |
| V16 | `implementation/evidence/V16/`、`.design/screenshots/v16-final-consistency/` | `implementation/notes/2026-08-26-V16-HANDOFF.md` |

V16 transition closeout：`implementation/evidence/V16/transition-regression/` 记录 Homepage 非 Hero scene → `/works` 的异常 Hero 尾部闪帧与稳定修复终态。

## 4. Consistency Decisions Verified

- Scene grammar：Hero、Featured、Commission、Adoption、Catalog、Detail、Document、Form 与 State surface 共享 typography、圆角、规则线、行动和中文 wayfinding，但各自保持不同 Composition，没有退化为统一卡片模板。
- Runtime：Hero、Featured、Homepage Adoption 使用页面内 4s carousel；正式公开路由只使用短 opacity 入场，不启用跨页媒体 morph。
- Adoption：V11 supersede T21 首页单项规则，最多投影三项 `available`；`/adoptions` 只公开 `available`，`adopted` 保留在 `/works`。
- Featured：V04 双图约束仅为历史记录；当前以 V09+ Type × Media、当前 switching 和 GATE-E 为准。
- Locks：Footer 未改；Hero `有点小狗工作室` 品牌身份、冻结终态与一次性首次入场未回退。
- Accessibility/state：V15 的 634 个可见 controls 最小 44×44、30 项 No-JS、36 项 Design Review、90 项六档矩阵和 6 项 500 证据继续作为最终输入/偏好基线；V16 fresh evidence 未发现回归。

## 5. Open-source / Font / License Traceability

- `config/third-party-assets.json`：Noto Serif SC（OFL-1.1）、ZhuoHei Collage 与 critical subset 的来源、用途和授权口径。
- `app/assets/licenses/third-party-summary.json`：当前安装态 production 依赖快照，796 个包；`ffmpeg-static@5.3.0` 标记 GPL-3.0-or-later。
- `public/THIRD_PARTY_NOTICES.txt`：公开第三方声明。
- `public/fonts/`：实际分发字体字节与登记一致；Noto Serif SC 只用于 PDF，系统字体只引用不分发。
- 拼贴字体按用户明确决定不在 V16 重新阻塞；现有 Lemi 免费商用来源记录继续保留，不误称为开源软件。

## 6. Gate Boundary

V16 Evidence/Review/Handoff 已获凌巽确认，T47 已开放。真实手机验收和 GATE-E 不因本索引自动完成或开放。
