# T03 · 二维码媒体垂直切片

## 基线与范围

- 基线：`a9bb7b1 feat: add official contact channels`。
- 复用现有条件直传、私有 `assets`、`asset_variants`、稳定 `/web/` Key、公开 URL 映射和资产处理重试 API。
- 不新增上传器、operation 表、媒体依赖、二维码识别或前端卡片；后台五行编辑与公开视觉属于 T04/T05。

## 实现

- 新增 `site/contact + contact_qr` 上传归属，owner 版本复用 `site_content.contact_content_version`。
- 只接受至少 320×320、方形、20 MB 内 PNG；原图保存在私有 Bucket，资产 `fit_mode=contain`。
- 新增 `contact-qr-v1 / contact-qr / protection_mode=none`，按源宽生成 320/640 PNG 阶梯；处理串仅含方向纠正、`m_lfit` 和 PNG 重编码，不裁切、不填充、不加水印。
- 公开对象 Key 复用现有环境前缀和 `/web/{assetId}/recipe/usage/width/identity.png` 规则，身份由源摘要、尺寸、配方和处理参数固定。
- 上传完成后资产先保持 PENDING，整套公开派生验证完成才切 READY；失败保留私有原图并标记 `UPLOAD_DERIVATIVE_FAILURE`，复用 `/media/assets/{id}/retry-processing` 重试。
- 公开 contact 只输出“账号 + READY 资产 + 完整派生”的渠道和 PNG SourceSet；缺失或损坏项受控隐藏。DTO 不含 `qrCodeAssetId`、私有 Object Key或签名 URL。
- 新增前向迁移 `0028_requirement_2_contact_qr.sql`，重建并恢复 `assets`、`upload_sessions`、`asset_variants` 的 CHECK、索引和相关触发器；未修改历史迁移。

## 验证

- 首次 `pnpm db:generate -- --name requirement_2_contact_qr`：未生成文件；历史快照存在交互式列冲突确认，当前非 TTY 环境拒绝执行。改为按既有 `0022/0024` 模式手写前向重建迁移。
- 首次迁移定向测试：25/26；旧基线到当前新增两条迁移，测试仍断言 `applied: 1`。改为 2 后通过。
- 首次 typecheck：公开 PNG SourceSet 的 null 缩窄与候选类型不完整；显式类型谓词并补齐候选字段后通过。
- 首次 T03 垂直用例：功能通过，泄漏断言误把公开稳定 URL 中的资产标识视作私有资产字段；收敛为禁止 `qrCodeAssetId`、`/original/` 与签名信息后通过。
- 首次 lint：专用配方存在空 `catch`；改为显式 `variantStillUsable` 后通过。
- `pnpm test -- tests/unit/site-content.test.ts`：3/3。
- T03 相关 integration：42/42。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。

## 结论

`PASS`。T03 工程实现已完成；T04/T05 管理与公开界面、T15 公开图片解码和真实手机扫码、T16 独立 Review、T17 用户验收保持开放。
