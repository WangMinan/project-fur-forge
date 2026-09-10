# 2026-09-10 · 需求6立项与文档交接

## Completed

用户要求先阅读关联讨论并做本地交叉确认；之后明确确认“禁止隐藏最后一张可展示图片”和“旧作品逐件编辑重新发布启用，不自动批量重裁”，再要求新建分支并先组织文档。

- 只读基线：本地 main 与 fetch 后 origin/main 均为 `5e0d2f1cac73f91050568e05c2c321bbc322484b`，与远端讨论一致；建分支前工作树干净。
- 工作分支：`codex/r6-work-image-composition`。
- 按 _template 建立需求6的全部九类文件，增加本交接；更新已有 agent_docs 导航与 CLAUDE 薄入口。AGENTS.md 仍为指向 CLAUDE.md 的符号链接。
- 本次未改应用代码、依赖或数据库，未执行迁移、测试发布或生产操作。

## Locked Decisions

用户确认的产品选择已完整转入 [SPEC](../../requirements/SPEC.md) 的 OQ 和契约；不在本交接另建第二套规格。工程默认见 [PLAN](../../planning/PLAN.md)。

## 本地代码事实与前序复现

| 事实 | 代码位置 |
| --- | --- |
| 目录4:5、代表作品3:4共用旧card | [WorkCard](../../../../app/components/WorkCard.vue)、[FeaturedWorks](../../../../app/components/FeaturedWorks.vue) |
| 小图与大图共用sources，手机宽度收缩但min-height保持72px | [WorkDetailGallery](../../../../app/components/WorkDetailGallery.vue) |
| 领养目录手机16:9，平板/PC auto | [AdoptionCard](../../../../app/components/AdoptionCard.vue) |
| 首页领养contain，画框不固定，hover放大旋转 | [HomeCurrentAdoptions](../../../../app/components/HomeCurrentAdoptions.vue) |
| 旧配方3:4/16:9、单套crop、焦点九宫格 | [media-recipe](../../../../server/utils/recipe/media-recipe.ts)、[media-source](../../../../server/utils/recipe/media-source.ts) |
| 领养列表优先设定图、作品缺图优先封面、详情附加图投影 | [public-site-repository](../../../../server/utils/repository/public-site-repository.ts) |
| 三类媒体保存删除再插入关联 | [work-management](../../../../server/utils/service/work-management.ts) |

前序只读评估使用 @playwright/test + 系统 Edge（headless），提取 WorkDetailGallery/ResponsivePicture 的 scoped CSS 并展开 deep，根字号16px、border-box、合成图片；未加载生产数据。结果：

| CSS视口宽度 | 缩略图按钮外框 |
| --- | --- |
| 390 | 62.390625 × 72 px |
| 430 | 68.796875 × 72 px |
| 450 | 72 × 72 px |
| 768 / 1023 / 1024 / 1440 | 88 × 88 px |

这是缺陷的最小复现，不是整页兼容性、修复验证或真实手机验收。复现使用命令标准输入运行，没有保存图片测试产物。

## Open Issues

无待用户回答的产品 OQ。真实裁切像素、Cropper接入、跨平台迁移和资源边界仍需在功能实施中验证；不能将本次文档自查代称代码 Review 或用户验收。

## Regression Risks

- 旧源按usage/version整体读取，新增构图不能导致重复档位被判无完整srcset。
- 单套crop和预处理最小尺寸计算不能直接复用为多用途配置。
- 图片关联重写、详情初始选图、来源角色与updated_at排序需要共同覆盖。
- 媒体策略历史章节仍有水印/返图表述；需求导航已指向明确后续覆盖，不能据此恢复退役功能。

## Next Task

后续收到功能实现指令时，先读 STATE / SPEC / PLAN / models / TASKS，从 T01 顺序执行。每个增量验证后更新真实状态。

## Do Not Start Yet

本次任务仅文档；未授权在此次文档工作中实施功能、安装依赖、运行迁移、批量重建、删除生产媒体、触发镜像或部署。未提交或推送的文档不能写成已合入 main。
