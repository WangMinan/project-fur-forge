# 需求7 · 站点文案生产迁移

本文件是操作员交接，未表示已在生产执行。先遵守 [部署文档](../../../docs/DEPLOYMENT.md) 与 [生产发布手册](../../需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)，核对本次冻结 SHA、已发布不可变镜像摘要、现行生产数据库和回滚镜像。历史手册中的旧阶段和主机状态不作为当前现场事实。

## 交付脚本与数据变化

迁移脚本：[0054_r7_site_content_translations.sql](../../../server/database/migrations/0054_r7_site_content_translations.sql) 与 [0055_r7_x_contact.sql](../../../server/database/migrations/0055_r7_x_contact.sql)。由既有 `ops/ops.mjs migrate` 按 journal 执行；不直接用 sqlite 命令重复执行 SQL 文件。

- 增加 `site_content.home_content_version`，默认 1；现有中文字段及旧分区版本不改写。
- 新建 `site_content_translations`，以语言＋分区为主键；已有英文首页、委托、工作室正文作为一次性初始记录。仅在原委托状态存在时初始化英文营业标签，并按当时 tone 选择标签。
- 新建空库使用同一套 journal 完整初始化，也会执行 0055 并写入 X 默认地址，无需另跑 seed 或后台手工填写。
- 0055 新增 x_contact_url，以 https://x.com/jece9925 初始化；不改写原邮箱/QQ 等配置。后续在后台联系方式保存，迁移重入不重置地址。
- 不修改既有联系方式、法律原文、通知收件人、金额、作品、媒体身份或对象。迁移中的英文初值不在应用启动或后续保存时重新写入。
- 重复运行迁移入口输出 `applied=0`，已编辑的译文不被覆盖。升级旧库时自动生成迁移前备份；仍须按生产流程显式备份并保留可恢复证据。

## Ubuntu 操作顺序

在已核验的生产仓库根目录执行。代码及 Compose 与选定冻结 SHA 一致，`.env` 中 `APP_IMAGE_REF` 已指向该版本已发布的 `repository@sha256:...`；保留旧镜像摘要和所有现有环境值。先拉取并核验新镜像，再安排短暂停写窗口。

```bash
docker compose config --quiet
docker compose pull app
docker compose stop app

R7_BACKUP="/app/backups/pre-0054-$(date -u +%Y%m%dT%H%M%SZ).db"
docker compose run --rm --no-deps app node ops/ops.mjs backup --output "$R7_BACKUP"
docker compose run --rm --no-deps app node ops/ops.mjs migrate
# 复跑确认 applied=0；不会重新填充英文初值。
docker compose run --rm --no-deps app node ops/ops.mjs migrate
docker compose up --detach --no-build --no-deps --force-recreate app
```

从已完整执行至 0053 的库升级，首次 `applied=2`；已经执行 0054 的库首次为 `applied=1`；更早的库须先核对全部待执行迁移及其专属流程，不能只按本文件跳过历史门槛。任一步失败即停止后续步骤并保留输出、备份和旧摘要；不要删表、删 journal 或重写迁移 hash 来强行重试。

## 验证

1. 按部署文档验证 `/api/health/ready`、SQLite integrity/FK、公开和管理 Host，以及公开 API 的缓存行为。API 与管理界面继续绕过共享缓存。
2. 后台“站点配置”应有三个分组，公开文案可切换中文/English；中文内容与升级前一致，英文有初始文案，条款与隐私仍为中文原文。
3. 修改并保存一处英文正文后刷新后台及公开页，确认数据持久化；留空应显示中文参考且公开页回退中文。恢复本次验证的临时改动。
4. 后台修改 X 主页地址，验证公开关于页、委托页、申请页与首页入口和显示账号一致，刷新后保留；完成后恢复正式账号。
5. 中文表单可用；英文入口仍通往 X；公开 SSR 初次请求即呈现对应文案。图片投影和媒体访问不受影响。
6. 更改营业开放程度后，人工核对中英营业标签。标签是可编辑内容，系统不自动重写管理员文案。

## 回滚边界

0054 在数据结构上是加列、加表，但应用严格校验完整迁移历史：只含 0053 的旧镜像会拒绝已执行 0054/0055 的数据库；只含 0054 的镜像同样拒绝 0055 数据库。因此不能直接把旧镜像接到升级后的卷，也不能删 journal 或降低校验绕过。

- 应用功能回退：制作保留 0054/0055 schema/journal 的兼容修复镜像，经验证后使用新不可变摘要部署。原中文字段、翻译记录都保留。
- 回到升级前版本：另获数据库恢复授权后，使用与备份匹配的旧冻结镜像，按部署恢复流程把升级前备份恢复到新路径，验证旧版本 migration history、integrity/FK，再一起切换 DATABASE_FILE 与镜像。
- 备份之后的新写入不会出现在旧备份中；切换前评估并保全这些数据，不能用恢复掩盖数据丢失。任何恢复覆盖或删除仍须单独授权。

保留升级前备份、升级后数据库和两个版本摘要。迁移失败时先检查是否事务已回滚，再判断是否恢复；仅换镜像不等于数据恢复。

## 以后新增日语或韩语

无需新增数据库列或复制管理页面。在共享语言清单注册语言及申请/联系模式，补充 UI 语言资源并校验浏览器匹配；后台自然出现该语言选项，未建立分区记录的版本为 0，首次保存创建。新语言正文逐字段回退中文，不强行回退英文。实际开放前完成译文、渠道与布局验收；本期不提前开放选项。
