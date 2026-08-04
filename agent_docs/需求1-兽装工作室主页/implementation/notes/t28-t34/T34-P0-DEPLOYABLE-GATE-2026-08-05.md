# T34 P0 全链与可部署门禁

## 启动边界

- 启动基线：`23b8004`，`main` 与 `origin/main` 一致，工作树干净。
- 范围：完整静态/单元/集成/E2E/build/production verify、公开与管理真实浏览器全链、SQLite 备份恢复、真实双 Bucket、部署镜像、secret scan 和独立 Review。
- 复用：现有 Playwright 临时空库/管理员/假媒体全链、T31 备份恢复命令、`preflight:oss`、`preflight:watermark` 和 production 守卫；不另建第二套测试框架。
- 用户门禁：本记录可以关闭工程 finding，但 T34 在用户最终验收前保持未勾选。

## 修复前初始 finding

基线结论：`NOT PASS`。

1. **MUST-FIX · 缺少可部署镜像定义**：PLAN 明确一期为单 Docker 镜像，TASKS T34 要求形成首个可部署镜像，但仓库没有 `Dockerfile` 或 `.dockerignore`，无法构建、验证非 root 运行、持久数据库挂载、重启保持或镜像 secret 边界。应只增加最小多阶段镜像和精确 context 排除，不提前实现 T52 的目标环境编排、TLS、域名或数据库迁移自动化。

## 执行记录

待全量门禁后补充。初始 finding 不得在修复后删除。
