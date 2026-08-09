# T51 工程记录（2026-08-09）

## 结论

**PASS WITH FOLLOW-UP（实现、素材审计与自测）**。公开导航品牌、备案生产配置、页脚空值/已配置投影和当前 tracked 素材审计已在基线 `f730393e680ecf27db2c074b4d7bd9f4130d67c7` 之上完成。正式素材选择仍由用户确认；新上下文独立 Review 统一由 T49 执行。

## 范围与非目标

- 公开桌面/移动导航及复用公开壳的登录页使用独立常量，精确显示“有点小狗”；
- `ownerDisplay`、SEO 组织名、版权/条款主体和工作室介绍继续使用既有完整名称；
- 新增 ICP 号/链接与公安备案状态/号/链接的类型化运行时配置、官方域名限制和安全公开 DTO；
- 未配置字段完整隐藏；真实审批值只在阶段 F 写入远程配置，不在仓库制造占位内容；
- 复跑确定性品牌衍生并审计当前 tracked 图片的尺寸、方向、SourceSet 能力与三固定视口；
- 不重设计公开站，不操作备案平台、云资源、DNS、Bucket、ESA 或远程主机，不提前实现 T52。

## 备案投影

- ICP 号与链接必须成对；链接只允许 HTTPS `beian.miit.gov.cn`；
- 公安备案状态为 `unconfigured | not_applicable | filed`；只有 `filed` 必须成对提供号与链接，链接只允许 HTTPS `beian.gov.cn`/`www.beian.gov.cn`；
- production 必须显式声明公安备案状态，防止“忘填”被解释为“不适用”；
- 公共 `/api/site-meta` 只投影完整的显示值，响应 `no-store`；配置不完整时应用启动校验失败，不向页面泄漏部分值。

## 素材审计

- 3 个 Logo 源均为 `2048×2048`；`pnpm brand:generate` 重放后输出哈希不变，组合标有效像素未贴边；favicon `16×16`/`32×32`、Touch Icon `180×180`、分享图 `1200×630`；
- 当前小狗作品/出厂照候选 7 张，只有 `小狗-2-横版.jpg` 是明确横版 Hero 候选；不存在配套独立竖版 Hero；
- 3 张设定图中 `领养-3.jpeg` 为 `1560×1080`，低于 `design-sheet` 的 `2400px` 生产宽度要求，不能以放大冒充细节；
- 两张返图为 `1139×2083`、`1600×2400`，现有动态宽度阶梯可生成到 `1080px` 的完整 SourceSet；
- 历史清单中的根目录 `小狗出厂照-1.jpeg`～`-4.jpeg` 与 `委托-返图示例-虾片.jpeg` 不在当前 `main`，已从可用候选中移除；
- 详细登记见 [`../../../materials/MATERIAL-MANIFEST.md`](../../../materials/MATERIAL-MANIFEST.md)。

## 首次失败与修复

1. T51 SEO 浏览器回归首次在 fixture seed 返回 `500`。定位为既有测试 fixture 的作品 INSERT 有 19 个列/参数但只有 18 个占位符；修正为 19 个占位符后，既有 SEO 与 T51 回归全部通过。该修复只影响测试 fixture，不改变生产 SQL 或公开契约。
2. `pnpm verify:production` 首次仍要求首页 SSR 包含旧公开品牌“有点小狗工作室”，后续又暴露英文品牌大小写断言漂移；拆分诊断并同步为 T51 锁定的“有点小狗”与 `DITE DOG` 后重放通过。法务/SEO 主体未做全局替换。

该发现属于实现自测，不是独立 Review finding。

## 验证证据

- `APP_ENV=test pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- `pnpm test`：21 files / 129 tests PASS；
- `pnpm test:integration`：20 files / 162 tests PASS；
- `APP_ENV=production pnpm build`：PASS，production content guard PASS；
- `pnpm verify:production`：PASS（health、公开 SSR、管理 CSR）；
- T51 定向运行时/常量单元：15 tests PASS；
- T51 真实 Chrome 批次：11 tests PASS，覆盖公开/登录壳短品牌、空备案/长备案、许可证链接、图片解码、三固定视口、横向溢出与 console；
- `pnpm brand:generate`：PASS，tracked 品牌衍生无差异。

本地通过不代表 GitHub Actions 全绿；远端同一 SHA 门禁仍由 T49 取得。

## 未关闭门禁

- [ ] 用户确认最终 Logo、作品、返图等正式上线素材；
- [ ] 用户提供或选择独立竖版 Hero；若采用 `领养-3.jpeg`，提供更高分辨率源；
- [ ] T49 新上下文独立 Review；
- [ ] T49 同一 SHA 远端 CI。
