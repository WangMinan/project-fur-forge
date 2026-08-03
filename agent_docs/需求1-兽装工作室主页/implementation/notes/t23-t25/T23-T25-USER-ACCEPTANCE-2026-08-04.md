# T23–T25 用户人工核验与公开媒体配方修正

> 状态：用户人工核验通过；T23、T24、T25 仍待新的 GPT-5.6 Sol 上下文独立 Review，因此任务框保持未勾选。

## 用户结论

2026-08-04，用户确认 T23–T25 其他功能没有问题，并要求在以下两项修正后记录当前阶段人工核验通过：

1. `/works` 只展示有出厂照的作品；只有设定图的常规领养继续保留在 `/adoptions` 与统一 `/works/{slug}` 详情；
2. 横版设定图使用左右两枚等大水印；首轮 2.0 倍结果发生重叠后，用户要求稍微缩小，最终固定为上一配方的 1.6 倍，左右不重叠。

本记录只代表用户业务与视觉验收，不冒充独立 Review，也不自行勾选 T25。

## 最终实现

- 公开作品列表在共享公开投影处要求至少一张可公开出厂照；领养列表和 canonical 详情不受影响。
- `recipe-v2` 使用明确宽度预处理水印，实际边长为 `recipe-v1` 的 1.6 倍；普通作品图和首页图仍为单枚居中水印，`design-sheet` 连续使用 `g_west` 与 `g_east` 两枚相同水印。
- 新版本完整前按用途读取完整 `recipe-v1` 集合；v2 的 WebP 与 fallback 完整后整体优先 v2，不混用半套新旧 srcset，也不覆盖旧公开对象。
- 阿里云依据：[图片水印参数与多水印示例](https://help.aliyun.com/zh/oss/user-guide/add-watermarks)、[图片缩放与 `limit_0`](https://help.aliyun.com/zh/oss/user-guide/resize-images-4)。

## 验证证据

- `pnpm lint`：PASS；
- `pnpm typecheck`：PASS；
- `pnpm test`：13 文件 / 85 用例 PASS；
- `pnpm test:integration`：12 文件 / 91 用例 PASS；
- `pnpm build`：PASS；
- 公开站定向 E2E：`public-adoptions.spec.ts` 与 `public-works.spec.ts` 共 24/24 PASS，覆盖只有设定图的领养不进入 `/works`、仍可进入 `/adoptions` 和统一详情；
- 真实 OSS：`gate07-20260803T164718Z-9a5676b6` PASS；使用 MATERIAL-MANIFEST 登记的 `领养-1.jpeg` 生成左右双水印设定图，匿名私有读取为拒绝，作品卡、详情、设定图、首页横图、首页竖图均生成成功，测试对象精确清理完成，未记录秘密；
- 视觉检查：960×533 正式设定图中左右水印留有中间间隔，三视图、头像和色板可辨识。

## 剩余门禁

在新的 GPT-5.6 Sol 上下文中独立 Review T23–T25，结合正式素材、管理 Host、公开 Host、三视口、console/network/DOM 与私有信息边界重新检查。Review 结论形成前，T23、T24、T25 均保持未勾选；不提前进入 T29 或 T37。
