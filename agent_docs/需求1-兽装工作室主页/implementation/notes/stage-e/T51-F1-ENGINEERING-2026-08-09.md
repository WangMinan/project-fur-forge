# T51-F1 工程记录（2026-08-09）

## 1. 基线与边界

- 写入前 `main` / `origin/main` / tracking SHA：`3f3d4b8bdb168724cc3337b6a74fb6bed5d88a06`；工作树初始干净。
- 范围：收紧 `/works` 页名与筛选条间距；使低分辨率设定图可上传、保存并经私有 FFmpeg Lanczos 适配后发布。
- 非目标：不新建上传器、公开配方、operation 状态机或迁移；不替换用户原图，不宣称放大恢复细节；不代签 T49 独立 Review。

## 2. 实现

1. `/works` 复用现有 `WorkFilterBar`，只移除组件额外顶边距；真实 Chromium 在 `390×844`、`768×1024`、`1440×900` 断言标题底边到筛选条顶边不超过 `32px`。
2. 发布检查不再为低分辨率 `design_sheet` 返回硬阻断，改为 `designSheetNeedsPreprocess` 非阻断提示；出厂照尺寸规则不变。
3. 现有 work publication operation 在 `PREPARING_SOURCE` 阶段调用内嵌 FFmpeg，用 `scale=...:flags=lanczos` 按原比例放大到当前配方所需最大宽度；不强制高度、不裁主体，避免超宽图的不必要巨幅放大。
4. 验证后的 PNG 以 `design-sheet-upscale-lanczos-v1` 不可变私有 `preprocess` 变体保存；条件写入使用 Base64 `Content-MD5`，再校验 head、摘要、尺寸、格式和字节。永久原图不覆盖，`recipe-v2` 只消费 READY 处理源。
5. 设定图区和发布区持续说明“可发布、FFmpeg 适配、不恢复细节、原图保留”。适配失败保存 `DESIGN_SHEET_UPSCALE_FAILED` / `PREPARING_SOURCE`，作品保持草稿，管理端给出重新发布或换更清晰图片的中文选择。

## 3. 验证与首次失败

相关结果：

- `pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- `pnpm test`：PASS，21 files / 130 tests；
- `pnpm exec vitest run tests/unit/oss-preflight.test.ts`：PASS，11 tests；
- `pnpm exec vitest run --config vitest.integration.config.ts tests/integration/work-publication.test.ts`：PASS，12 tests；
- 真实 Chromium 低分辨率设定图流程：PASS，含上传/保存、非阻断提示、故意私有写入失败、明确恢复文案、重试发布成功、原图与私有适配对象并存；
- 真实 Chromium `/works` 间距回归：PASS；
- `APP_ENV=production pnpm build`：PASS；
- `pnpm verify:production`：PASS，最终 `.output` 的 health、公开 SSR 与管理端 CSR 边界验证通过。

首次失败保留：

- 调整最小几何计算后，第一次针对性 integration 断言错把 fixture 声明尺寸当成实际 PNG 尺寸，出现比例断言 NOT PASS；修复 fixture 使像素与资产元数据一致后，同一针对性套件 12/12 PASS。
- 完整 `pnpm test:integration` 仍为 **NOT PASS**：19 个文件中 18 个完成，154 个测试通过，`tests/integration/auth-api.test.ts` 的 9 个测试因 Nuxt test-utils 启动/就绪握手在服务端代码 `0` 退出后全部 skip；独立重跑同样 NOT PASS。生成的 Nitro server 以同一环境手工启动可持续监听，未定位为本次 DTO/FFmpeg 链路回归；该 NOT PASS 留给 T49 门禁修复，不表述为完整 integration 全绿。

## 4. 结论与未关闭门禁

T51-F1 实现和相关路径自测完成，用户反馈的两项行为已落地。结论仅是实现交付，不是 T49 新上下文独立 Review，不是用户浏览器验收，也不是 GATE-E 或发布就绪签署。
