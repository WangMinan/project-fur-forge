# 需求3 · 产物登记

> **角色**：登记需求3实施、评审、迁移和验收产生的可长期保存产物。
> **状态**：当前只有规格文档；工程与验收产物待生成。
> **红线**：本目录不得保存 PII、真实委托图片、返图/动态内容、数据库备份、Secret、签名 URL 或完整 Object Key。

## 1. 当前文档产物

| 产物 | 状态 | 说明 |
| --- | --- | --- |
| `foundation/README.md` | 已创建 | 锁定产品、数据、媒体和隐私边界。 |
| `requirements/SPEC.md` | 已创建 | 需求3权威产品契约。 |
| `.design/README.md` | 已创建 | 桌面/移动 Hero、动效、作品、领养和表单设计约束。 |
| `models/README.md` | 已创建 | 目标表、DTO、媒体和退役模型。 |
| `planning/PLAN.md` | 已创建 | Expand/Migrate/Contract 实施路线。 |
| `planning/DATA-MIGRATION.md` | 已创建 | 永久删除和 Schema 重建方案。 |
| `implementation/TASKS.md` | 已创建 | 唯一任务勾选权威。 |
| `implementation/EXECUTION_ROUTING.md` | 已创建 | 实现、Review 和用户验收路由。 |
| `STATE.md` | 已创建 | 当前阶段与下一步。 |

## 2. 预期工程产物

实现后登记实际路径：

| 产物 | 预期内容 | 状态 |
| --- | --- | --- |
| Expand migration evidence | 空库/既有库、Hero 拆分、状态映射、foreign key、integrity。 | 待生成 |
| Adoption cover evidence | 缺图计数、补图完成计数、发布阻断和公开 SourceSet。 | 待生成 |
| Commission security evidence | Origin、限流、蜜罐、TTL、重复消费、PII 泄漏负向测试。 | 待生成 |
| Motion/browser evidence | 390/768/1023/1024/1440、hover/focus、route transition、reduced-motion。 | 待生成 |
| Local destructive drill | 仅含计数、总字节、状态、退出码和最终验证。 | 待生成 |
| Contract migration evidence | 表/列/枚举不存在、integrity、foreign key、production build。 | 待生成 |
| Independent review | 首次 findings、修复、重测和最终结论。 | 待生成 |
| User acceptance | 用户对公开端、后台、手机和删除结果的签署。 | 待生成 |
| Production retirement evidence | dry-run 脱敏计数、确认、删除状态、迁移版本、净化备份、服务恢复。 | 待生成 |

## 3. 可保存的浏览器产物

可以保存使用虚构数据的：

- 首页桌面/移动截图；
- 导航 hover/focus 和页面切换录屏；
- Hero 横竖管理截图；
- 简化作品与领养页面截图；
- 委托表单空表、校验错误和虚构成功态截图；
- 委托后台使用纯虚构手机号、QQ、称呼和图片的截图；
- Playwright trace、console/network 摘要。

不得保存真实用户提交或景宸后台中包含真实联系方式的截图。

## 4. 永久删除证据格式

长期证据只能包含类似结构：

```text
scope: local | production
operationVersion: <版本>
returnCharacters: <count>
returnPhotos: <count>
privateObjects: <count>
publicObjects: <count>
objectVersions: <count>
backupsRemoved: <count>
esaPurge: complete | failed
foreignKeyViolations: 0
integrityCheck: ok
sanitizedBackupRestore: pass | fail
completedAt: <UTC timestamp>
```

不得附带名称、正文、asset ID 列表、完整 Key 列表或可恢复数据。

## 5. 登记规则

- 每个产物必须链接对应 TASK 和 dated note；
- 自动化、独立 Review、用户验收和生产操作分开登记；
- 新 SHA 产生后，旧 SHA 的 CI 证据不能继续代表当前 HEAD；
- 失败记录不能删除，修复后追加重测结论；
- 生产破坏性证据只能在实际执行后标记完成。
