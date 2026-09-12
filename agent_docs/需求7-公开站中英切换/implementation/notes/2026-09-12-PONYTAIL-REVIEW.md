# 当前分支冗余审查与清理

- 范围：按用户授权，对当前分支（含本轮开始时已有的未提交实现）进行全仓代码引用和重复片段扫描，逐项核对候选及调用链，清理已确认冗余。使用 ponytail-review；用户明确要求修复，覆盖 skill 默认只列发现的限制。
- 此记录只证明冗余审查，不代签 T11 的独立完整实现 Review、人工验收、发布或生产操作。

## 已修正

| 位置 | 发现与处理 |
| --- | --- |
| `app/composables/useAdminSiteContent.ts` | 删除原样返回相同键名的版本映射，直接使用分区键。 |
| `app/composables/useSiteContentSectionCard.ts` | 重置和采用最新值共用同一函数，保留既有调用接口和草稿隔离。 |
| `shared/schemas/site-content.ts`、`site-copy.ts` | 中文旧入口和多语言入口复用委托、关于及安全纯文本 schema；联系方式读写复用顺序/账号校验，保留公开渠道子集规则。 |
| `shared/schemas/work.ts`、`site-meta.ts` | 删除没有调用方的旧公开价格 schema 和备案状态 schema；后台金额和实际备案输出保留。 |
| `server/utils/repository/publication-repository.ts`、`recipe/site-display-recipe.ts` | 删除没有调用方的旧变体格式查询和计数函数；当前发布资格与配方处理路径保留。 |
| `scripts/oss-preflight-core.mjs` 及声明文件 | 删除没有调用方的 createRunId、parseImageInfo、ossErrorSummary 及相应声明/import；实际预检入口保留。 |
| `tests/helpers/migrations.ts` 与十份集成测试 | 统一历史迁移目录构造与后续迁移计数，保留原有全部测试用例及关键断言；未知迁移 tag 显式报错，并增加可执行断言。 |

不把仍用于历史升级、恢复或旧请求兼容的路径当成死代码。没有修改历史 migration、数据库或部署配置，也未新增依赖。

## 验证

- 本轮代码净减少 669 行，其中测试净减少 509 行；以本轮开始前的工作树快照比较，不将需求7原有改动或本记录计入清理成果。
- lint、typecheck、生产 build（含生产内容 guard）、脚本语法及 diff 空白检查通过。
- 完整 core：64 文件、329 项；首次 328 通过，唯一失败为原有 R6 测试写死“0052 后只应用 1 个迁移”，与新增 0054/0055 后实际 3 个不符。改为 `migrationsAfter('0052_r5_commission_email')`，保留媒体链路、版本、FK/integrity 与重入断言；R3/R6 相关两文件 13 项复验通过。329 项均有通过证据，不声称修正后再次全量执行。
- Chrome smoke：`tests/smoke/admin-site-copy.spec.ts` 两项通过，覆盖保存、草稿保护、冲突、空译文回退、X 配置及 390/768/1440 宽度；相应测试截图刷新。
- 未提交、推送、创建 PR、发布镜像或部署生产。
