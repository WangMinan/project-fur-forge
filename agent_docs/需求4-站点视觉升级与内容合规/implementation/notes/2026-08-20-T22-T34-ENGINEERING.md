# 2026-08-20 · T22～T34 当前开发范围与 PR #21 Review 修复

> **证据边界**：本文只记录任务分支的本地工程实现与合成数据验证。不代签专业法律意见、独立 Review、王旻安/景宸验收、真实手机、生产迁移/删除、Linux 发布镜像、Docker Hub 分发核验或发布。

## 1. 提交分组

1. `55487b9` · PR #21 PublicationPanel 当前任务优先级、cleanup retry 防重/可再试与过时文档口径。
2. `5d4c7f8` · `0045_r4_default_copy`、两项 literal-true 确认、上传前/消费前校验。
3. `bf33c85` · retention 候选、单条精确删除 service/API/CLI/UI、隔离演练。
4. `e7c60bc` · production dependency notices 生成、资产 registry 与 `/licenses` 生成事实消费。
5. `f84f3c9` · pending/accepted 单条删除只允许 CLI 显式 `--manual-approved`，管理 UI/API 仍只对 rejected 开放。
6. 后续提交 · 用户确认处理者名称为“有点小狗工作室”；`0046_r4_privacy_controller` 只覆盖空值/精确历史默认并复用当前邮箱。

## 2. 稳定不变量证据

- `pnpm check:fast`：通过；test groups 为 core 50、legacy Vitest 21、legacy E2E 24、smoke 文件 1；core 50 文件 / 319 项全部通过。
- `pnpm build`：通过；Nuxt 4.5.1 / Nitro 2.13.4 production build 与 production content guard 完成。
- PublicationPanel 目标 Playwright：2/2 通过；覆盖旧 publish DONE 之后立即下架，cleanup retry active/loading/disabled，同步连点只一请求，失败后可再试。
- 文案迁移 + 委托 service/API integration：3 文件 / 26 项通过；管理员自定义文案保留，privacy 不写占位，缺失/false 确认时 upload 仍为 COMPLETED 且 submission 为 0。
- 处理者隐私政策迁移 focused database：19/19 通过；精确旧默认写入“有点小狗工作室”与当前 `contact_email`，自定义政策保留，迁移重入不再改写。
- 单条删除 core：6/6 通过；CLI 默认 dry-run/固定强确认：1/1 通过。覆盖 current/version/delete marker、PRIVATE variants、异常外部引用、OSS 非 NotFound 失败、DB commit 失败后重入、重复执行、非 rejected 人工批准门禁、FK/integrity 和不可恢复 ID 摘要审计。
- notices unit：2/2 通过；`pnpm notices:generate` / `pnpm notices:check` 通过。产物为 798 条包/版本+资产、20 种许可证表达，无本机路径/生成时间，未知许可证 fail closed。
- `git diff --check`：通过。

## 3. 真实浏览器 focused smoke

视口覆盖 `390×844`、`768×1024`、`1440×900`，均使用合成数据与内存 fake storage：

- 两项确认默认未选，错误邻近且键盘 Space 可操作；未确认时 PUT 记录为 0，字段和预览保留；确认后可提交。
- rejected 列表显示“删除申请数据”；未认证 API 为 401；dry-run 对话不含手机号、QQ 或 Key；连续确认只一请求、处理中 disabled，失败保留可重试，成功后返回列表并移除行/私有对象。
- `/privacy`、`/service`、`/licenses` 均可读且无水平溢出；privacy 显示处理者“有点小狗工作室”、当前联系邮箱和真实收集字段，无旧“不收集”默认；`/licenses` 有 TXT 下载，不含 gyan.dev、旧 FFmpeg source revision 或“均为 MIT/Apache”错误总括。

## 4. 明确未执行

- GitHub Actions 本月额度已耗尽；本轮没有 dispatch、rerun 或等待任何远程 workflow。
- 没有连接真实 OSS/ESA，没有运行生产迁移、生产删除、Docker build、镜像发布或部署。
- 个人信息处理者名称已由用户确认；生产仍需执行前向迁移并核对公开隐私政策与当前 `contact_email`。
- T35/T36 Linux FFmpeg runtime registry、容器嵌入、Docker Hub 分发核验与 release evidence 后置；GATE-D 不因本轮开发结果自动关闭。
- T37 及之后的 Hero 焦点、动效和首页四幕未进入。
