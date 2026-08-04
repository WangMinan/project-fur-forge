# T31 备份、恢复与迁移冒烟

## 结论

- 实现提交：`b8a41e3`；独立 Review 修复提交：`f3ec7fd`。
- 独立 Review 初审为 `NOT PASS`；1 个 MUST-FIX 关闭后最终为 `PASS`。T31 可以勾选。
- 用户授权 T28–T34 作为单一长程批次连续实施；本结论不代替 T26-F1、T27-F1、T30 或 T34 的用户验收。

## 实现范围

- 新增 `pnpm db:restore -- --input <backup.db> --output <new-database.db>`，只允许恢复到不存在且不是活动数据库的新路径。
- 恢复前后均检查 SQLite 完整性、外键和当前 17 条迁移；迁移历史按顺序逐项核对时间戳与 hash。
- 损坏、空、陈旧、迁移漂移、外键破坏、源目标相同、目标已存在和活动库目标均拒绝；失败只清理本次新建目标。
- 媒体 Host 的非页面错误不再递归请求 Nuxt HTML 错误页；缺失媒体返回 JSON 404，公开/管理 Host 仍使用既有 HTML 错误页。
- 未新增存储系统或依赖；复用 SQLite Backup API、现有迁移读取器、运行配置和错误封装。

## 初始 findings 与修复

1. 实现方生产恢复冒烟发现：媒体 Host 的 404 被错误处理器再次投递到同一 Host 的 `/__nuxt_error`，形成递归并耗尽内存。根因修复为只有公开/管理 Host 渲染 HTML 错误页；回归验证媒体 404 后 health 仍为 200。
2. 独立 Review MUST-FIX：初版只比较 `__drizzle_migrations.created_at`，篡改首条 hash 后恢复仍成功。修复为现有 `migrationState` 统一执行有序 `created_at + hash` 前缀校验；启动检查、迁移和恢复三条入口共同拒绝漂移，并确认无目标残留。

## 恢复一致性

使用当前开发库的在线只读备份复制出隔离夹具，再在副本补 1 条短属性。源库与新路径恢复库逐表数量和内容摘要完全相同：

| 数据 | 数量 |
| --- | ---: |
| 作品 / 已发布作品 | 3 / 2 |
| 短属性 | 1 |
| 原始资产 / variant / 作品媒体关系 | 20 / 61 / 5 |
| 首页与委托大图 | 2（两个 placement 均启用） |
| 站点内容 / 营业状态 | 1 / 2 |
| 水印 profile / 活动品牌引用 | 5 / 1 |
| 水印操作 / 发布操作 | 8 / 45 |
| 迁移 | 17 |

恢复库 `integrity_check=ok`、外键违规 0；活动 profile、发布状态、作品媒体关系、短属性、两个大图 placement 与公开投影均保留。CLI 对活动 `.data/dev.db` 目标以非零状态拒绝，未改写用户数据库。

## 自动化与独立 Review

- `pnpm lint`：PASS。
- `pnpm typecheck`：PASS。
- `pnpm test`：16 文件、102 项 PASS（独立 Review）。
- `pnpm test:integration`：12 文件、99 项 PASS；数据库定向 11/11，数据库与媒体 Host 合并定向 17/17。
- `pnpm build`：PASS，production content guard PASS。
- 独立负路径覆盖损坏/空/陈旧/hash 漂移/FK 破坏、缺失源、源目标相同、已有目标、活动库目标、含空格与规范化 Windows 路径以及失败清理。

## 恢复库浏览器证据

- production `.output` 使用新路径恢复库启动；公开首页、`/works`、`/works/doggy`、`/adoptions`、`/works/cloud`、`/commission`、`/about`、`/service`、`/privacy`、`/contact` 301 与后台 `/admin/login` 均正常。
- 独立 Chrome 重新点击首页 → 作品列表 → 详情，详情可见恢复夹具的非空短属性；后台登录页表单正常，匿名 Session 401 符合预期。
- 公开 HTML、API 与 DOM 未出现 `privateObjectKey`、`ownerContact`、私有 Key、签名或 `/original/`。
- 恢复库保留 OSS Key/variant 引用，但 SQLite 备份不会复制 OSS 对象字节；隔离测试媒体存储没有开发对象，因此图片 404 属已知环境边界。媒体 404 后 health 仍为 200。

## 清理与后续

- 四个经核对的 T31 临时数据库目录已精确删除；验证服务已停止。
- T32 继续安全门禁；T33/T34 在真实媒体环境验证图片解码、三视口和完整链路。
