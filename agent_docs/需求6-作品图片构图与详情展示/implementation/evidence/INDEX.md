# 需求6 · 验证证据

## 自动验证

| 验证 | 结果与范围 |
| --- | --- |
| lint / typecheck | 通过，使用仓库原有命令 |
| production build | 通过，包含guard-production-content；不是镜像发布 |
| 核心测试 | 初次全并发运行出现旧列清单断言和构建/FFmpeg超时；更新列清单后，60文件306项以maxWorkers=2通过，auth-api/health的19项以maxWorkers=1通过；随后新增旧源链迁移用例并通过，合计326项分批覆盖。几何收口后另跑11项定向回归通过 |
| Ubuntu | Node24.18.0 / pnpm11.18.0，首次相关24项通过；最终几何、公开契约、旧库迁移共16项通过，包含升级、重复执行、原图/变体源链和业务版本保留 |
| 许可证 | Ubuntu冻结锁文件安装后generate/check通过；新增Cropper.js2.2.0及其模块，三份声明产物同步 |
| Playwright | `pnpm exec playwright test --config playwright.smoke.config.ts image-composition.spec.ts` 通过；后台选区六档还原、取消、独立用途保存、在线来源/显隐与发布；公开六档触控/键盘、方形尺寸、decode、无横向溢出、prefers-*模拟 |
| 独立Review | 三项初始finding与一项追问已修正并关闭，见 [REVIEW](../../review/REVIEW.md) |

测试源码：[几何](../../../../tests/unit/image-composition.test.ts)、[公开与构图契约](../../../../tests/integration/public-site-contracts.test.ts)、[迁移](../../../../tests/integration/r3-works-contract.test.ts)、[浏览器](../../../../tests/smoke/image-composition.spec.ts)。

浏览器第一次点击失败来自只等待Nuxt根实例、图库尚未完成水合；复核trace无page error后改为等待实际图库组件mounted，六档触控与键盘通过，不以重复点击或固定延迟掩盖。截图中的图片为合成图，不含真实客户资料。

## 浏览器产物

- [六视口尺寸、decode与性能观察](viewports.json)
- [390后台构图](editor-390.png)
- [1440后台构图](editor-1440.png)
- [1440详情](detail-1440.png)

390px与430px缩略图约62.4×62.4、68.8×68.8；其余四档88×88，均不小于44px。该场景CLS为0；首个冷启动视口LCP约6476ms，其余约364～540ms。只记录开发服务器与合成图结果，不代签生产指标。

## 真实OSS只读像素核验

使用本地开发库中一个已发布出厂照的完整源图，凭据仅由既有运行配置读取；不输出私有Key、不保存源图、不写云对象。

1. OSS `image/auto-orient,1/format,png` 返回1600×2400完整PNG。
2. 使用实际 `buildPublicMediaProcess` 生成4:5的300×375选区请求，读取PNG结果。
3. 使用现有ffmpeg-static解码两份PNG为RGBA；从完整RGBA按同一坐标逐行提取300×375，与OSS结果逐字节相等。
4. 输出尺寸正确，exactPixelMatch=true，cloudWrites=0。

依据：[OSS按顺序处理参数](https://www.alibabacloud.com/help/en/oss/user-guide/overview-17/)、[自动方向](https://www.alibabacloud.com/help/en/oss/user-guide/auto-rotate-4)。仅本次源和选区经过真实服务验证，其他场景由合成回归覆盖。

## 本地环境

本地开发库已有54个迁移记录（截至0053），`pnpm db:migrate` 复跑applied=0，integrity_check为ok，`/api/health/ready` 全部检查通过。现有迁移前备份在 `.data/backups/`，不进入Git。存量不自动启用由隔离旧库测试证明，不通过改动开发作品内容验证。

真实iOS/Android、用户人工观感和生产运行仍待相应验收，不在本索引勾选。
