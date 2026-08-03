# T17 最小非领养作品管理 API · 工程记录

> 日期：2026-08-01（按批次约定保留文件名日期）  
> 范围：仅工程侧 DTO、SQLite、事务、受保护 API 与测试；未改写 Kimi 页面，未勾选 T17。

## API

- `GET /api/admin/v1/works`：管理作品列表。
- `POST /api/admin/v1/works`：创建 `commission | showcase` 草稿。
- `GET /api/admin/v1/works/{workId}`：管理详情。
- `PUT /api/admin/v1/works/{workId}`：用 `expectedVersion` 更新基础字段、私有联系人和 0–8 条有序短属性。
- `PUT /api/admin/v1/works/{workId}/studio-photos`：用一个短事务全量替换 0–5 张出厂照关系；数组顺序即展示顺序，同时维护唯一主图、alt、焦点、裁切和水印锚点。省略旧 assetId 即解除未发布关系，不删除永久 asset 或原图。
- `GET /api/admin/v1/works/{workId}/public-preview`：返回公开安全预览数据和 `mediaReady`，硬排除联系人、私有 Key、摘要和签名 URL。

## 契约与一致性

- T17 只接受非领养作品；字段固定为 characterName、slug、species、suitType、purpose、ownerDisplay、ownerContact 和 featureTags。请求为 strict schema，`ownerType`、deposit、payment、usd 等字段直接 400。
- `ownerDisplay` 必须显式为“有点小狗工作室”或“不公开”；联系人只存在于管理详情的 `private.ownerContact`，列表和公开安全预览不返回。
- 媒体角色固定为 `studio_photo`。关联前验证 asset 为 READY、由该作品的完成上传会话产生、未被其他作品占用；每组有照片时必须且只能有一张主图。
- 作品聚合作为唯一乐观锁：基础更新与出厂照集合替换都校验 `expectedVersion` 并只递增一次。已发布作品必须先下架再编辑，避免直接改变当前公开投影。
- 出厂照集合替换、关系解除、asset 展示参数同步和 work 版本递增位于同一 SQLite 短事务；无网络调用。
- 新增 nullable `work_assets.alt_text` 兼容旧迁移数据；T17 新写关系强制非空，数据库触发器拒绝空白/超长值，T18 发布再次执行完整性门禁。
- T16 配方读取关系级焦点、裁切和锚点；工作卡裁切进入 OSS 操作与 recipe identity，参数变化生成新公开 Key。
- `/api/admin/**` 继续统一复用 T13 的 401 Session、403 Host/Origin/CSRF 与 no-store/noindex 边界；服务层稳定输出 404/409，schema 边界输出 400，未识别异常由统一 500 处理。

## 验证

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test`：13 个文件、86 项通过。
- `pnpm test:integration`：9 个文件、50 项通过。
- 新增覆盖：创建/列表/详情/更新、slug/版本冲突、严格禁用字段、精确 ownerDisplay、私有联系人投影、READY studio_photo 归属、主图/排序/alt/焦点/裁切、关系解除不删 asset、公开预览 DTO/Key 泄漏扫描。

## 交接边界

T17 后端契约已锁定；Kimi 尚需把现有作品管理样张接入上述接口、处理 400/401/403/404/409/500、维护聚合版本并实现持久保存反馈，因此 `TASKS.md` 的 T17 保持未勾选。完整请求样例将在 `T14-T18-UI-HANDOFF.md` 汇总。
