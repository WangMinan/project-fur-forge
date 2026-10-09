# 0057 迁移交接

- 本次新增 `0057_r13_adoption_artist.sql`，在 works 上新增 nullable artist 与领养属性/长度约束；不改旧迁移、不重建表、不写媒体。
- 存量作品 artist 为 NULL；旧价格、领养状态、关联和发布时间保留。应用上线后，已有价格的公开领养作品（包括已领养）立即在详情展示，工作室应先核对金额。
- 新应用读取 artist，启动前须对目标库完成迁移。开发环境沿用 `pnpm db:migrate`；生产须另获授权并按目标冻结镜像及部署手册备份、迁移、preflight后启动，不能以本说明代替生产执行授权。
- 迁移入口自动在存在待迁移内容时备份已有库，完成后核验外键；测试另验证 integrity_check、旧金额保留、约束及重入 applied=0。
- 本轮迁移隔离测试库，并现场确认 APP_ENV=development、DATABASE_FILE 指向仓库内 .data/dev.db 后迁移本地开发库；该库原缺0056，一并应用0056和0057并自动生成备份。integrity_check=ok、foreign_key_check=0。未操作生产库。回退应用不应删除新增列或清空署名；具体生产恢复先核对目标版本兼容性与备份。
