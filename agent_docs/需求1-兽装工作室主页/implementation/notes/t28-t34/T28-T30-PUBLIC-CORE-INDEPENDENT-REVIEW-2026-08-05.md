# T28–T30 公开核心与独立 Review

## 结论

- 基线：`4f10c00`；实现提交：`68dd78d`、`98d13ce`。
- T28：`PASS`；T29：`PASS`；T30：`PASS WITH FOLLOW-UP`。
- 工程 finding 已全部关闭。T30 的 favicon、Apple Touch Icon 和分享图仍等待用户最终视觉验收，因此 T30 保持未勾选。
- 用户授权 T28–T34 作为单一长程批次连续实施；中间用户门禁统一延后至本批次末尾人工验收。批量继续执行不等于相应用户验收已经发生。

## 实现范围

- T28 复用 `ResponsivePicture`、`PublicBusinessStatus`、`AdoptionCard` 和既有公开 API，按 Hero → 精选 → 图片入口 → 营业状态 → 当前领养 → 页脚输出；缺数据时不造假内容。单个图片入口在桌面铺满，单个领养卡保持原有半栏节奏。
- T29 复用现有作品快照顺序补前后导航；保留已有用途 × 装型交集和结果数；`/adoptions/{slug}` 301 到 canonical `/works/{slug}`。
- T30 从现有深浅品牌图形源生成 16/32 favicon、180 Apple Touch Icon 与 1200×630 分享图；新增 canonical、OG/Twitter、可见事实 JSON-LD、Sitemap 和 robots。
- 未新增 CMS、筛选数据层、图标库或 SEO 依赖；未改变私有原图、Object Key、签名 URL 和水印源边界。

## 初始 findings 与修复

1. `P1`：只有一个委托/领养图片入口时，桌面两列留下半幅空白。修复为图片入口和单个状态跨满；补单入口 E2E。
2. `P1`：初版 16px 图标直接缩放后轮廓发灰。修复为先生成清晰的 32px 图形，再做 2:1 最近邻像素提示并硬化透明边缘。
3. `P1`：首次跨栏修复误让单个“当前领养”卡铺满，1440 视口图片过重且重复。修复为领养卡恢复两列宽度；最终桌面卡宽约 646px、图片高约 485px。

## 自动化与浏览器证据

- `pnpm lint`：PASS。
- `pnpm typecheck`：PASS。
- `pnpm build`：PASS，production content guard PASS。
- `public-site-contracts.test.ts` 定向集成：6/6 PASS。
- T28 定向 Playwright：3/3 PASS；独立 Chrome E2E：4/4 PASS。
- 独立 Chrome 复核：首页顺序、空 Hero 对比度、单入口、详情导航/键盘、301、canonical/JSON-LD、Sitemap/robots、图片解码、console/network 和公开泄漏检查通过；最终 console 0 error、0 warning，network 无失败。
- 三视口截图：[`screenshots/t28-home-continuation-390x844.png`](./screenshots/t28-home-continuation-390x844.png)、[`screenshots/t28-home-continuation-768x1024.png`](./screenshots/t28-home-continuation-768x1024.png)、[`screenshots/t28-home-continuation-1440x900.png`](./screenshots/t28-home-continuation-1440x900.png)。最后一次领养卡权重修复后重新复核了 390 与 1440；768 由自动化覆盖，未另写最终截图。

## 后续门禁

- T28、T29 没有独立用户门禁，可以勾选。
- T30 只缺用户对浏览器标签页、16/32 favicon、Apple Touch Icon 和分享图的最终视觉确认；技术 Review 不代签。
- 下一任务为 T31 备份、恢复与迁移冒烟；不进入 T35 或 T37。
