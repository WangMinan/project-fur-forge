# T47-F4 Handoff · Mobile / PDF / Public Media Retirement

## Completed

- 生产委托制作单字体路径改为 `.output/public/fonts/noto-serif-sc-regular.otf`；开发环境继续读取 `public/fonts/`。Noto Serif SC 改为完整嵌入，避免 fontkit CJK 子集被部分阅读器判为无效并显示方框。
- Homepage Hero 固定 3s；Featured 与 Homepage Adoption 保持 4s。
- 1023px 以下隐藏 Hero、Featured、Commission 的全部“下一幕”导线/文案；窄屏领养角色名保持单行，行动保持 44px 命中区并收紧字号/内边距。
- 自动图片叠加管理页、导航、API、profile/service/repository/runner、上传角色、预览组件、脚本和专项 fixture 已删除。
- 当前 Schema 删除 `site_branding`、`watermark_profiles`、`watermark_operations`，并从 assets、upload_sessions、asset_variants、work_assets、publication_operations 清除对应字段/状态；0051 保留正常业务数据并去重旧 profile 变体。
- 作品公开图升级为无叠加 `recipe-v4`；同镜像 `retire-legacy-public-media` 默认 dry-run，强确认后生成/验证 v4、精确删除旧 v1-v3 对象、ESA file purge、删除旧行。部署步骤已同步 `docs/DEPLOYMENT.md`。
- Nuxt 官方 cleanup 已清除删除模块后的自动导入缓存；类型检查不再引用已删除 repository。

## Locked Decisions

- 不改写历史 migration；只新增 0051。
- 页面里的低对比度工作室 Logo 是 CSS 背景标记，不进入媒体生成链。
- 远端升级必须停写，并使用同一冻结镜像依次 backup、migrate、退役 dry-run/execute、第二次 migrate、up/ready。
- 旧镜像回滚必须同时恢复升级前数据库和对象存储版本，不能只换镜像。

## Open Issues

- 真实 iOS Safari 动态工具栏手感、390/430 窄屏观感和生产 PDF 仍需人工验收；自动化不代签。
- 本分支未部署生产、未执行生产 migration、未删除生产对象。

## Regression Risks

- 0051 会重建五张表；部署前必须保留显式备份，迁移后必须校验 applied=0、FK/integrity 和 ready。
- 旧公开媒体退役可能耗时；失败时 app 保持停止并重入同一命令，不能跳过 v4 完整性核验。

## Next Task

- 完成 390×844、430×932、768×1024 浏览器检查、制作单 PDF 渲染检查和完整 core/build。

## Do Not Start Yet

- 未获明确发布授权前，不触发镜像发布、远端迁移或生产媒体退役。
