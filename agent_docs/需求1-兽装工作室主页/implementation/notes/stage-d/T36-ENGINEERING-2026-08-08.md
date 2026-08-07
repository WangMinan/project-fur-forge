# T36 实施记录：返图上传、无水印公开衍生、管理端与返图墙

> **日期**：2026-08-08。
> **本任务 commits**：
> `11ed84a T36: return photo publication runner and public wall projection`、
> `0514488 T36: add public returns wall`、
> `9a92cda T36: add return admin console and low-res admin thumbnails`、
> `161a22e fix(T36): project protection_mode and use valid sizes on the return wall`。
> **性质**：dated note。当前权威见 `requirements/MEDIA-PUBLICATION-POLICY.md`
> 与 `.design/`。

## 1. 无水印公开配方

`server/utils/recipe/return-display-recipe.ts`：

```text
media_role = return_photo
usage = return-wall
recipe_version = return-display-v1
protection_mode = none
watermark_profile_id = NULL
```

- 处理串 `image/auto-orient,1/resize,m_lfit,w_N/...`：先按 EXIF 方向烘焙旋转，
  再等比限宽，**不裁切、不填充**；重编码输出使原始 EXIF（GPS、设备、原文件名）
  不进入公开对象；
- 串里没有 watermark 算子，文件也不 import 任何 watermark 模块，
  因此活动 profile 切换在代码层面就不可能改变返图；
- 宽度阶梯 `[480, 768, 1080]`，按源图宽度收敛（`returnWallWidths`），
  最小源宽 480；不把小图放大成假高清；
- 每个宽度一份 WebP + 一份 fallback（源 PNG 用 png，其余用 jpeg）；
- 身份寻址不可覆盖；写后校验 MIME、宽度、字节数、摘要与**匿名可读**；
  高度允许 ±1 取整差异，其余精确比对。

## 2. 发布 operation

`server/utils/runner/return-photo-publication.ts` 复用
`publication_operations` 及其 attempt / lease / heartbeat / recovery_reason /
提交 CAS，只用 `entity_type='RETURN_PHOTO'` 区分，未新建第二套状态机。

- 发布序列 `GENERATING_PUBLIC → VERIFYING_PUBLIC → COMMITTING → DONE`
  （无水印阶段）；业务提交与 operation 置 DONE 同事务，因此不存在
  “已提交但 operation 非终态”的窗口；
- 失败只清理**本次 attempt 新建**对象，旧公开版本保持可读；
- 下架先撤销状态并登记精确 Object Key 清单，再逐个删除，重启可从残余清单继续；
- 注册 PUBLISH / UNPUBLISH 两个 resumer 到启动恢复插件；
- 一次有界重试吸收 OSS 冷读/瞬时失败。

## 3. 公开投影

`server/utils/repository/public-return-repository.ts` 只 SELECT 公开所需列
（返图 id、alt、关联作品角色名/slug、公开变体）。授权三列、私有 Object Key、
原文件名与 EXIF **根本不在查询里**。可见性同时要求返图与关联作品都 published，
因此作品下架后关联返图立即从返图墙消失，而记录与私有原图保留。

## 4. 返图墙布局（为何保持可访问顺序）

`ReturnMasonry.vue` 使用**确定性 CSS Grid row-span**，不用 `column-count`
或 `grid-auto-flow: dense`：

- 外层 `container-type: inline-size`；网格 `grid-auto-rows` 等于
  `(100cqw - (列数-1) * gap) / 列数 / 100`，即**列宽的 1/100**；
- 每项跨 `round(100 * 高 / 宽)` 行 + 固定 caption/间距行配额，
  因此图片高度与源图比例精确对应，不同列自然形成不等高排列；
- `row-gap: 0`：跨行元素的高度不会被行间距累加放大；项间距由行配额提供；
- 自动放置按**行主序**填充，所以 DOM 顺序、Tab 顺序、屏幕阅读顺序
  与视觉阅读顺序一致——这是选它而不选 `column-count` 的原因；
- 全部行数在 SSR 时算好，无 JavaScript 也能得到正确布局，且不产生 CLS。

固定参数：4/3/2/1 列（≥1280 / 768–1279 / 340–767 / <340），
gap 20/16/12px，圆角 12px，caption 在图片下方 8px 只显示关联作品名，
每项一个主链接到 `/works/{slug}`。底部编号分页为普通链接（每页 24 条）。

## 5. 三次真实缺陷与修复（用真实数据发现）

1. **公开投影恒为空**：`resultCount=1` 而 `items=[]`。
   `loadReturnVariants` 的 WHERE 过滤了 `protection_mode`，但 SELECT 没有投影该列，
   `variant.protectionMode` 为 `undefined`，完整性检查必然失败。补上投影列。
2. **页面不受宽度与页边距约束**：`.public-container` 只是语义标记，
   实际宽度与 padding 由页面自己的类提供（`/works` 即如此）。
   给 `.returns-page` 补 max-width、居中与页边距。
3. **`sizes` 属性写了 CSS 变量**：HTML 的 `sizes` 不解析 `var()`，
   整条失效后退回 `100vw`，给约 312px 的格子下载了最大变体，浪费 OSS 流量。
   改为合法的媒体条件 + 长度；DPR 1 时现在选 480 而不是 1080。

## 6. 管理端与流量优化（按用户反馈）

- 返图列表：3rem 固定缩略图格子、搜索 + 关联作品 + 发布状态筛选
  （与作品管理看齐）、编号分页；
- 编辑页七分区：关联作品 / 返图图片 / 说明与排序 /
  授权记录（可选，仅后台可见）/ 私有与无水印公开预览 / 发布与恢复 / 危险操作；
- 新增 `MediaStorage.getPrivateProcessed`，预览端点支持白名单宽度
  `?w=64/96/160/320/640`，缩放在 OSS 侧完成。实测返图缩略图
  **711 KB → 11 KB**，23 MB 海报缩略图 30 KB；作品管理表格与卡片一并改为低分辨率；
- 超过 OSS 20 MB 处理上限的原图走既有私有预处理源；处理失败回退原图，
  缩略图不再让整行变破图；
- 无水印公开预览地址改由服务端在管理 DTO 给出，**不跨 Host 调用
  `/api/public/**`**（管理 Host 会按边界拒绝）；
- 预览框固定 22rem 高度，竖图与极端长图不再拉长页面；
  刷新后按服务端事实显示“私有原图已就绪”。

## 7. 真实双 Bucket 浏览器证据（1440×900）

真实 OSS 凭据可用，使用正式返图样例 `虾片-1.jpg`（1139×2083）：

- 管理端登录 → 返图管理 → 新建草稿 → 上传 → 私有原图已就绪（尺寸 1139×2083 正确）；
- 发布：6/6 变体生成，任务状态“已完成”，已发布后关联作品与图片输入被锁定；
- 无水印公开预览命中
  `return-display-v1/return-wall/480/…webp`；
- 返图墙：4 列 312px / gap 20px，图片 312×571 保持原比例，
  声明了 `width`/`height`，caption 显示“小狗”，无横向溢出；
- 768×1024 三列 / gap 16px；390×844 两列 / gap 12px，均无横向溢出；
- 公开导航顺序：首页 / 作品展示 / 返图墙 / 自设委托 / 角色领养 / 关于我们。

## 8. 未验证边界（不得当作已通过）

- 390×844 真机手机维护闭环（查看/新建/选作品/单图上传/alt/授权文字/发布/下架）
  尚未逐项点击；
- **针对返图 operation 的 SIGKILL 与重复重启重放尚未执行**；
  现有 `operation-interrupt` 测试覆盖的是作品发布；
- 私有原图匿名 GET 失败、profile 切换前后返图摘要不变等断言
  已由架构与测试保证，但尚未在真实 Bucket 上逐条重放记录；
- 新上下文独立 Review 与用户人工验收未进行。

## 9. 文案

公开端称“返图墙”，管理端称“返图管理”（用户 2026-08-08 确认）。
