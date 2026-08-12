# T04 · 后台五平台编辑体验

## 基线与范围

- 基线：`0e2fb1a feat: add contact QR media pipeline`。
- 扩展 `/admin/site/content` 现有 contact Card，继续使用固定五平台数组、contact 分区版本、上传会话、条件 PUT、处理重试和局部保存。
- 不增加公开渠道卡片、平台 Logo、数据表、上传协议或依赖；这些边界中的公开视觉属于 T05。

## 实现

- `SiteOfficialChannelsCard` 由同一 `officialChannels` 数组固定渲染 QQ、抖音、QQ群、小红书、Bilibili 五行，分别提供账号输入、二维码上传/替换、私有预览和完整性提示。
- 新增 `useContactQrUpload`，复用现有上传 API：浏览器先验证 PNG、20 MB、至少 320×320 且方形，再创建 `site/contact + contact_qr` 上传会话、条件直传、完成处理；派生失败沿用现有 retry-processing API。
- 上传 READY 后只更新当前 contact 草稿中的 `qrCodeAssetId`，仍需管理员点击本 Card 的保存按钮才写入 `official_channels_json`；重载后通过受认证预览路由恢复二维码。
- 上传会话携带 `contact_content_version`。创建或完成阶段遇到 409 时刷新最新 contact 数据、保留本地账号草稿并展示对比，不自动覆盖或重发。
- 修复共享分区草稿的嵌套 Vue Proxy 克隆：分区 DTO 是严格 JSON，改用 JSON 往返递归生成独立草稿，避免 `structuredClone(toRaw())` 只解开外层后抛出 `DataCloneError`。

## 验证

- 首次 Edge E2E 暴露 `DataCloneError`；修复共享草稿克隆后，完整文件 6/7 通过。余下一例最初填写了已保存的相同 QQ 值，保存按钮按设计保持禁用；改为新值后该定向用例报告通过。
- 上述 Edge 定向进程随后在 Windows 清理 Playwright webServer 时超时，因此不把该次命令退出状态记为完整 PASS；用例主体已经输出 `ok`，清理稳定性留待 T15 的正式浏览器门禁复核。
- `pnpm test:integration -- tests/integration/contact-qr-media.test.ts tests/integration/site-content-sections.test.ts tests/integration/auth-api.test.ts`：3 files、15/15。
- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `git diff --check`：通过。

## 结论

`PASS WITH FOLLOW-UP`。T04 功能、定向集成与静态门禁完成；T05 公开渠道卡片、T15 正式三视口/二维码浏览器验证、T16 独立 Review、T17 用户验收保持开放。
