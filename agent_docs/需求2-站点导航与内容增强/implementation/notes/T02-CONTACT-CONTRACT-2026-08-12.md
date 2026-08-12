# T02 · 五平台 contact 契约与前向迁移

## 实现

- 新增 `site_content.official_channels_json`，固定顺序为 QQ、抖音、QQ群、小红书、Bilibili；账号和二维码资产引用可空。
- 迁移 `0027_requirement_2_contact_channels.sql` 将旧 `contact_qq`、`contact_douyin` 值带入数组；旧列保留，但新 contact 写入口只更新 JSON。
- 管理 DTO 输出完整五项和私有 `qrCodeAssetId`；公开 DTO 只输出有账号的平台，不包含资产 ID。
- contact PUT 继续使用原 contact 分区版本、CAS 更新、审计日志和 409 草稿语义。
- 现有后台 Card 暂以原 QQ/抖音输入编辑对应数组项，并保留其它平台及资产引用；T04 再扩展为完整五行编辑。

## 验证

- `pnpm test -- tests/unit/site-content.test.ts`：3/3 通过。
- `pnpm test:integration -- tests/integration/site-content-sections.test.ts tests/integration/database.test.ts tests/integration/domain-schema.test.ts`：31/31 通过。
- `pnpm test:integration -- tests/integration/auth-api.test.ts`：9/9 通过。
- `pnpm lint -- ...`：通过。
- `pnpm typecheck`：通过。

覆盖固定平台集合和顺序、账号格式、空新平台、旧库迁移、旧列保留、重复迁移、数据库约束、公开 DTO 私有字段剥离、Host/CSRF 和 contact 分区 409。

## 后续

T03 接入 `contact_qr` 私有上传与 READY 公开派生后，公开渠道将进一步要求账号与二维码派生同时完整才输出。
