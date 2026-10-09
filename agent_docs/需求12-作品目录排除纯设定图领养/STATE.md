# 状态：需求12 · 作品目录排除纯设定图领养

## 当前阶段

2026-10-09：本地实现与验证完成，已直接提交推送 main，并启动出包。实现提交/冻结 SHA：`d8199261f7adb0548646e4ed85d4ddcb929e2551`。用户明确授权直接在 main 修改、推送并启动出包；基线 `757d66e`，开始时工作树干净且与 origin/main 一致。

## 当前约束

仅收紧作品目录资格，共享领养与详情快照保留。无数据库迁移、媒体写入、生产部署。

## 最近验证

已核对需求4/6、公开 repository、发布校验和调用方：旧文档显式允许设定图兜底，本需求局部覆盖；与现有发布和领养机制兼容。

- lint、typecheck 通过；`adoption-projection` 7项、`public-site-contracts` 与 `work-publication` 合计30项通过。
- Chrome smoke 1项通过，覆盖390/1440宽度的目录筛选、搜索、领养进入详情、图片加载、无页面横向溢出及无console/page错误。截图位于本地 `test-results/sheet-only-adoption-sheet--b0005-ns-reachable-from-adoptions/`，使用合成媒体，非生产内容或真实手机验收。
- 新构图回归初次失败是测试帮助函数只生成旧用途；改为复用 `workAssetPublicUsages` 并提供满足完整详情尺寸的封面后，旧/新构图全部通过，未放宽生产校验。
- 本次文档相对链接与 `git diff --check` 通过；production build及生产内容守卫通过。

## 待确认问题

无。

## 下一步交接

已启动 [release-image 37875044353](https://github.com/WangMinan/project-fur-forge/actions/runs/37875044353)，标签 `works-catalog-20261009-d819926`，启动核验为 queued，headSha 与实现提交一致。本记录是启动后的文档补记，不改变该次冻结代码。

镜像是否发布成功、digest 及远端质量结果尚未核验，不将启动记为出包成功。未执行生产部署、数据库迁移或媒体操作；实际线上生效须后续部署。具体执行状态见 [TASKS](implementation/TASKS.md)，契约见 [SPEC](requirements/SPEC.md)。
