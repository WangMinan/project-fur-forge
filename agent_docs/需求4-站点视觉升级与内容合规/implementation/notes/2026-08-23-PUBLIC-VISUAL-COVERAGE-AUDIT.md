# Public Visual Coverage Audit

日期：2026-08-23  
范围：需求4阶段 E 的公开站美术优化任务完整性；不实施页面代码。  
结论：`GATE-V00` 只完成 Art Direction 选择，不是全站完成门禁。原 V06～V08 未覆盖统一详情、法务/许可证和全局错误/媒体失败状态，且 V10 错误包含了已冻结 Footer；本轮已补齐任务归属。

## Scope Boundary

- 本轮“网站内容美工优化”覆盖公开站页面、公开共享组件和可见状态。
- Hero 只冻结既有约定的品牌文字终态；其余 Hero 视觉继续由 V01 处理。
- `PublicFooter.vue` 的内容、布局、样式、响应式和交互全部冻结；后续只检查相邻页面不会覆盖或挤压它。
- 管理端不进入公开站 Editorial Art Direction。管理端已有 T04～T12 的行动、进度、上传和 Hero 信息架构基线；公开视觉任务只能做共享改动后的回归，不顺带重做后台。
- 不新增业务字段、DTO、API、迁移、媒体规则、平台联系方式或依赖。

## Route Coverage Matrix

| 实际入口 | 实际模板/组件 | 原任务 | 审查结论 | 修正后任务 |
| --- | --- | --- | --- | --- |
| `/` | `index.vue`、四个 Homepage Scene | V01～V05 | 已覆盖；Hero 文字终态冻结，Footer 冻结 | V01～V05 |
| `/works` | `works/index.vue`、`WorkCard`、Search/Pagination/Empty | V06 | 有归属但状态描述过粗 | V06 |
| `/adoptions` | `adoptions/index.vue`、`AdoptionCard`、Search/Pagination/Empty | V06 | 有归属但状态描述过粗 | V06 |
| `/works/[slug]` | `works/[slug].vue`、`WorkDetailGallery` | 无 | 完全遗漏；作品与领养共用的核心详情状态 | V06-F1 |
| `/adoptions/[slug]` | 301 到 `/works/[slug]` | 无 | 不应建立第二套详情 | V06-F1 验证重定向 |
| `/commission` | `commission/index.vue`、`CommissionLead`、联系网格 | V07 一句带过 | 摄影主导且状态复杂，应独立成任务 | V07-F1 |
| `/commission/apply` | `commission/apply.vue`、上传与确认 | V08 | 只写了错误/可提交，漏不可用、上传、失败、成功等状态 | V08 |
| `/about` | `about.vue`、联系与防诈骗 | V07 | 已覆盖但需明确 1/2 渠道与锚点 | V07 |
| `/contact` | 301 到 `/about#contact` | V07 名称误导 | 不应建立独立页面 | V07 验证重定向 |
| `/service`、`/privacy` | `PublicLegalDocument` | 无 | 完全遗漏；长篇中文阅读系统 | V07-F2 |
| `/terms` | 301 到 `/service` | 无 | 不应建立独立页面 | V07-F2 验证重定向 |
| `/licenses` | 独立许可证/资产/下载页面 | 无 | 完全遗漏；Mobile 多列可读性风险最高 | V07-F2 |
| 404 / 500 | `app/error.vue` | 无 | 完全遗漏 | V08-F1 |

仓库共有 13 个公开路由文件，其中三个是重定向；再计入全局 `error.vue`，实际归并为 11 个独立视觉页面状态。目录空态、图片失败和无 JavaScript 回落不是新页面，但必须随 V06/V08-F1 进入验收。

## Screenshot Evidence

所有文件位于 `.design/screenshots/coverage-audit-2026-08-23/`。

| 代表性页面上下文 | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Home | `coverage-home-desktop-1280.png` | `coverage-home-tablet-768.png` | `coverage-home-mobile-375.png` |
| Works Catalog | `coverage-works-desktop-1280.png` | `coverage-works-tablet-768.png` | `coverage-works-mobile-375.png` |
| Work Detail | `coverage-work-detail-desktop-1280.png` | `coverage-work-detail-tablet-768.png` | `coverage-work-detail-mobile-375.png` |
| Adoptions Catalog | `coverage-adoptions-desktop-1280.png` | `coverage-adoptions-tablet-768.png` | `coverage-adoptions-mobile-375.png` |
| Adoption Detail Context | `coverage-adoption-detail-desktop-1280.png` | `coverage-adoption-detail-tablet-768.png` | `coverage-adoption-detail-mobile-375.png` |
| Commission | `coverage-commission-desktop-1280.png` | `coverage-commission-tablet-768.png` | `coverage-commission-mobile-375.png` |
| Commission Apply | `coverage-commission-apply-desktop-1280.png` | `coverage-commission-apply-tablet-768.png` | `coverage-commission-apply-mobile-375.png` |
| About / Contact | `coverage-about-desktop-1280.png` | `coverage-about-tablet-768.png` | `coverage-about-mobile-375.png` |
| Service | `coverage-service-desktop-1280.png` | `coverage-service-tablet-768.png` | `coverage-service-mobile-375.png` |
| Privacy | `coverage-privacy-desktop-1280.png` | `coverage-privacy-tablet-768.png` | `coverage-privacy-mobile-375.png` |
| Licenses | `coverage-licenses-desktop-1280.png` | `coverage-licenses-tablet-768.png` | `coverage-licenses-mobile-375.png` |

长截图中少量页脚/后半段重复是浏览器对 sticky、scroll snap 与懒加载页面做全页拼接时的采集伪影；DOM 检查确认每页只有一个 Footer，首页也只有一个 Featured、Commission、Adoption 标题。该伪影不作为产品 finding。

## Findings

### Must Cover

1. **统一详情页此前无任务**：桌面横/竖图详情都存在大面积无意图留白，移动端虽然可用，但缺少与目录和 B+M3 方向一致的 Archive Scene；多图缩略图、混合比例与领养来源返回也需要共同验收。
2. **法务与许可证此前无任务**：服务/隐私是超长纯文本，许可证 Mobile 的名称、用途和许可证列明显挤压；必须有独立 Reading System，不能交给最终响应式检查临时修补。
3. **错误与媒体失败此前无任务**：公开 API 失败统一进入 `error.vue`，图片组件承担全站媒体；两者都属于用户实际可见内容。
4. **Footer 边界冲突**：原 V10 要“统一 Footer”，与用户最新冻结决定冲突，现已改为完全不修改 Footer。

### Should Cover

1. **Commission 不应埋在 About 任务里**：它拥有独立 Hero、营业状态、Hero 缺失回落、制作范围、估价、联系渠道和共享媒体路径，已拆为 V07-F1。
2. **Apply 状态应完整**：不可用、文件拒绝、上传、处理中、服务错误和成功回执均是同一表单体验，不只检查空白/错误/可提交。
3. **Catalog 状态应列全**：无内容、无匹配、非法筛选、越界页、长名称/物种、状态/价格和极端比例都由已有共享组件承担，不另建组件。

## Execution Result

- 新增已完成的 `V00-F2` 覆盖审计。
- 新增 `V06-F1`、`V07-F1`、`V07-F2`、`V08-F1`。
- 收紧 V06、V07、V08、V09～V12 的页面、状态和验收边界。
- 下一项仍是 V01；本轮未开始任何正式页面实现。
