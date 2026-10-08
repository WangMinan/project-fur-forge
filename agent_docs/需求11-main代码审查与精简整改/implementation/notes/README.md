# 实施备注：main代码审查与精简整改

## 当前备注

- 2026-10-08：用户要求先持久化12条意见，按 `_template` 新建需求11；本轮只写文档。
- 先 fetch 并核对 main 与工作树，再从 `origin/main` 建立 `codex/main-review-remediation-docs`。审查 SHA 见 [STATE](../../STATE.md)。
- [REVIEW](../../review/REVIEW.md) 保存前两轮审查的证据摘要；本轮没有重新运行其中的业务复现或自动测试，也没有把临时测试输出伪装为已提交工件。
- 文档验证覆盖九文件结构、F01–F12 在 REVIEW/SPEC/TASKS 的一致性、相对链接和未完成勾选；业务源文件保持不变。
- 没有代码实现、数据库迁移、外部操作、Git 提交/推送或 PR。后续实施记录应另按日期追加。

## 2026-10-08 追加实施

用户明确授权“严格围绕文档展开修复和代码清理”，此前仅归档限制已被覆盖。实施沿用当前分支，保持12项之外的业务范围和历史迁移不变。

### 组件与职责

- `useSingleWorkImage`：只管理两个单图入口的草稿/基线、恢复、重试和保存；原组件提供角色、DTO转换和payload，接收 saved/conflict/stateChange。
- `WorkImageUploader`：负责文件选择、上传动作和已有 UploadSessionCard；输入是当前作品身份/版本、锁定态、单图是否为空及已有上传 composable，不引入新的上传协议。
- `useCarouselControls`：负责控件显隐与定时清理；轮播方向、自动播放、画幅和布局仍在原组件。
- `verifyPublicImage`：共用匿名公开图片完整性比较；调用方继续管理配方、生成及失败语义。

### 已获得的验证

- F01–F04 首批定向：4文件、24测试通过。
- F05 首批上传/媒体完成定向：2文件、9测试通过；随后补充迟到完成提交回滚用例并纳入 core。
- lint、typecheck 通过，发现的未使用导入及新组件格式警告已修正。
- 默认包含 Nuxt 运行时套件的串行 core 在构建启动阶段长期未进入业务断言，已中断，未记为通过。
- 拆分运行：`pnpm exec vitest run --config vitest.core.config.ts --maxWorkers=1 --exclude tests/integration/auth-api.test.ts --exclude tests/integration/health.test.ts`：66文件、324测试全部通过（234.38秒）。本次没有调整测试时限或减少这些文件的断言。
- 生产构建与内容守卫通过；运行时开发模式18/19，未知Host由Nitro产物补验通过；浏览器25/25，详见 REVIEW 最终清单。
- 收尾复验：commission-retention 与 operation-lease 共19项通过，包含最终独立Node进程编辑测试；最终 lint/typecheck 与文档链接/编号/diff检查通过。独立 Review、实机验收、远程CI和发布部署仍未代签。

## PR合入（2026-10-08）

用户追加授权将当前分支通过PR合入main。提交按安全/恢复、实现精简、测试去重和文档分组，远程检查及合并结果以GitHub PR为准；本步骤不触发镜像或生产部署。
