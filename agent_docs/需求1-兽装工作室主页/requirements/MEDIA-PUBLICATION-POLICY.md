# 媒体公开与保护策略

> **角色**：当前媒体公开行为的唯一事实源。
> **最后校准**：2026-08-10。
> **状态分层**：媒体配方、阶段 D 页面、第 7 节 Endpoint 分离、T52-E2 私有/BPA preflight、T52-E3 ESA 公开投影和 T52-E4 精确缓存撤销均已完成工程实现。阶段 F 不再改变媒体产品契约，主要填写真实值、执行云配置和运行冻结 preflight；所需独立运维辅助脚本按 TASKS 的 F 边界处理。未在目标环境执行的 live 检查不得描述为生产通过。

## 1. 核心原则

是否打水印由公开展示位置与媒体用途决定，不由横竖方向决定。

- 首页 Hero、委托 Hero 和首页业务入口无水印；
- 标准作品、常规领养和展会掉落使用活动品牌水印；
- `/returns` 与设定返图页使用无水印返图派生；
- 永久原图、处理源、Logo 候选、管理预览和返图授权记录始终私有；
- 所有公开图片预生成、验证、去除不需要的 EXIF，并使用不可变身份；
- 浏览器不得用 `x-oss-process` 临时加工，也不得用 CSS 叠 Logo 冒充发布结果；
- 正式环境中“可被网页访问”不等于 OSS 匿名可读：两只 Bucket 都私有，访客通过 ESA HTTPS URL 访问网页衍生物；
- 下架分成两个诚实状态：页面投影立即撤销；ESA 服务器侧缓存通过精确 purge 撤销，完成时限必须在目标环境实测后记录。

## 2. 展示位置矩阵

| 展示位置 | 媒体来源 | 保护方式 | 用途/配方 |
| --- | --- | --- | --- |
| 首页 Hero 横/竖图 | 首页资产 | 无水印 | `site-display-v1` |
| 委托 Hero 横/竖图 | 委托资产 | 无水印 | `site-display-v1` |
| 首页委托/领养入口 | 独立入口源 | 无水印 | `home-entry-commission` / `home-entry-adoption` |
| 首页精选、作品列表/详情 | 作品主图/出厂照 | 活动水印 | `recipe-v3` + 活动 profile |
| 常规领养与展会掉落 | 设定图/出厂照 | 活动水印 | 与作品相同 |
| `/returns` 与 `/returns/{slug}` | `return_photo` | 无水印 | `return-wall` / `return-display-v1` |
| 管理端原图/Logo/处理源 | 私有对象 | 不公开 | 认证 Host、短期私有预览、`no-store` |

返图不使用“轻量水印”，也不随活动作品 profile 切换。

## 3. 已落地媒体身份

### 3.1 站点展示

`site-display-v1` 身份至少包含输入资产/摘要、公开用途、输出宽高/格式/质量、裁剪或焦点、配方版本和 `protection_mode=none`。不携带水印 Logo/profile/几何参数。

### 3.2 作品保护

作品、常规领养和展会掉落使用：

```text
recipe_version = recipe-v3
protection_mode = watermark
watermark_profile = active brand-centered-v2
```

profile 或配方像素改变都生成新 Key，在完整校验后原子切换。仍被引用的旧版本不能删除；新配方未完整生成前只允许整体回退完整 `recipe-v2` / `recipe-v1` SourceSet，不能跨配方拼接。

`recipe-v3` 保持版式语义，只修正作品竖图在高分辨率档位中水印显得过小的问题：

- 竖版 `studio_photo` 的 `detail` 与所有 3:4 `work-card` 仍为单个 `center` 水印；
- 水印以该用途最小输出宽度为参考，随 480/768/1200 或 960/1600/2400 档位等比放大；最小档位保持活动 profile 当前视觉基线；
- 横版原比例 `detail` 保持原有单居中尺寸；
- `design-sheet` 继续为左右两个不重叠水印，并按现有 960 px 参考宽度缩放；不得把双水印套到竖图。

低分辨率 `design_sheet` 不直接成为公开配方输入。作品发布时先按实际用途计算所需最小几何尺寸，使用内嵌 FFmpeg Lanczos 保持原比例放大并生成 `design-sheet-upscale-lanczos-v1` 私有 `preprocess` 变体；不裁掉主体、不覆盖永久原图，也不宣称恢复细节。后续 `recipe-v3` 只从验证为 READY 且不超过 OSS 处理输入上限的该处理源生成公开图。

低分辨率 `studio_photo` 采用同一发布链，但使用独立 `studio-photo-upscale-lanczos-v1` 身份。发布检查不以像素不足阻断；同一 publication operation 在 `PREPARING_SOURCE` 阶段按当前用途计算最小几何尺寸，主图同时覆盖 2400 px `detail` 与 1200 × 1600 `work-card`，非主图覆盖 `detail`。FFmpeg Lanczos 保持原比例生成 READY 私有 `preprocess` 变体，永久原图不覆盖；卡片焦点/裁切按处理源实际尺寸执行，后续 `recipe-v3` 只消费验证完成的处理源。适配失败保持作品未发布并保留原图，可重新发布重试。

### 3.3 返图

```text
media_role = return_photo
usage = return-wall
recipe_version = return-display-v1
protection_mode = none
watermark_profile_id = NULL
```

返图保持原始比例，使用 `resize,m_lfit`，按源宽收敛 480/768/1080 阶梯，提供 WebP 与 JPEG/PNG fallback；纠正方向后重编码并移除不需要的 EXIF；不公开 GPS、设备、原文件名或授权信息。

## 4. 不可变身份与公开投影

- 公开像素变化必须生成新对象，不能覆盖已发布 Key；
- 同一完整公开身份最多一条 READY 记录；
- READY 记录必须有 MIME、尺寸、摘要和正字节数；
- SourceSet 只从匹配用途、配方、保护模式和活动 profile 的 READY 记录组装；
- 数据库保存对象身份/相对路径，公开响应统一用 `MEDIA_BASE_URL` 组装稳定的 ESA HTTPS URL；
- 首页、作品、领养、返图和 Hero 复用同一 URL 组装规则，不各自复制逻辑；
- 公开 DTO 可以包含 ESA 媒体 URL；禁止的是私有 OSS Key、私有 OSS 签名 URL、原始 OSS Bucket 地址和 Secret；
- 首版不实现自定义边缘 URL 鉴权，后续若需要必须作为独立迭代重新设计和验收。

## 5. 首页入口与配方隔离

首页两个入口使用独立用途：

- `home-entry-commission`；
- `home-entry-adoption`。

即使和 Hero/作品使用同一源资产，也要生成独立身份，以保证入口比例、无水印和精确清理。缺少完整 READY 入口图时使用受控无图状态，不回退到私有原图或任意作品。

展会掉落可作为当前领养数据来源，但自身卡片/详情仍使用作品水印；入口媒体仍是独立无水印用途。

## 6. 两只 Bucket 的生产职责（阶段 E 实现，阶段 F 执行）

### 6.1 私有原图 Bucket

保存：

- 永久作品/返图原图；
- FFmpeg 预处理、低分辨率 Hero、设定图和出厂照适配源；
- 水印 Logo 候选；
- 管理预览和临时处理对象。

要求：private + Bucket 级 Block Public Access；匿名 GET 403；不配置任何公开媒体 origin；私有 Key 不进入公开 DTO/HTML/日志；永久原图不受生命周期误删。

### 6.2 网页衍生 Bucket

应用新写入的生产对象只允许是经过完整身份生成和验证的网页衍生物。正式要求同样是 private + Bucket 级 Block Public Access，原始 OSS 域名匿名 GET 403。

既有 `dev/web/**` 等本地测试衍生对象可以暂时保留。生产预检不把“对象未登记在当前生产数据库”作为失败，也不清理这些旧对象；它们不能进入生产公开 DTO，不能借此把永久原图、处理源或管理预览写入衍生 Bucket。

禁止保存永久原图、处理源、Logo 源、管理预览、授权附件或其他私有数据。

CORS 在当前排障期可以使用通配 Origin/Header。生产预检只验证管理 Origin 的条件 PUT 能力，不要求精确 Origin/Header，不要求衍生 Bucket 删除 CORS；该放宽不改变条件签名、禁止覆盖、Key 前缀或对象公开权限。

ESA 同账号私有 OSS 回源可读取该 Bucket 全部对象，ESA 侧不能把“错误混入同一 Bucket 的私有对象”自动变安全。因此“这里只能放可作为网页媒体发布的衍生物”是生产安全门禁，而非命名建议。

### 6.3 现有 Bucket 直接切换

- 继续使用现有两只杭州 Bucket；
- 不新增生产/开发 Bucket；
- 不保留旧 public-read 地址、双读、代理或兼容重定向；
- 直接把两只 Bucket ACL 改 private，并开启 Bucket 级 BPA；
- 审计历史 Object ACL 与 Bucket Policy，不能只改 Bucket ACL；
- ACL 切换导致旧开发站直接 OSS 图片失效是已接受结果；
- 回滚不得恢复 public-read。

## 7. Endpoint 与上传边界（T52-E1）

| 场景 | 地址 |
| --- | --- |
| 杭州 ECS 服务端 OSS SDK | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 本地服务端 OSS SDK | `https://oss-cn-hangzhou.aliyuncs.com` |
| 管理浏览器条件 PUT | 私有 Bucket 杭州公网域名 |
| 公开网页媒体 | `https://public-media.ditedog.com`（ESA） |

- `OSS_ENDPOINT` 只供服务端 SDK；
- `OSS_UPLOAD_BASE_URL` 必须真正控制浏览器签名 URL Host，不能只存在于配置 Schema；
- `MEDIA_BASE_URL` 在生产固定为 `https://public-media.ditedog.com`，拒绝原始 OSS 域名；
- 生产签名 URL 绝不能包含 `-internal`；
- `.env` 生产实例、两个示例、runtime 示例/校验、部署说明和 preflight 同步；
- 当前应用 AK/SK 保持，仍只进入服务端 Secret。

当前实现使用两个彼此独立的 OSS SDK client：服务端读写使用 `OSS_ENDPOINT`，条件 PUT 签名使用 `OSS_UPLOAD_BASE_URL`。ESA purge 使用 `ESA_SITE_ID`、`ESA_API_ENDPOINT`，并与 OSS SDK 共用 `.env` 中现有的 `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`；不再维护重复的 ESA AccessKey 变量。公开路径是否必须是 `prod/web/**` 由 `APP_ENV=production` 判定，不再通过媒体域名猜测运行环境。

## 8. ESA 访问与缓存（T52-E3/E4）

### 8.1 同账号私有 OSS 回源

- `public-media.ditedog.com` 只回源网页衍生 Bucket；
- ESA 首次开启同账号私有 OSS 回源后，由阿里云使用 STS 临时令牌并在回源请求中添加 `Authorization`；业务应用不申请、不保存、不轮换 STS；
- 首版不部署自定义边缘函数或 URL 鉴权。公开媒体 URL 可直接访问，真正的私有边界是原始 OSS 匿名拒绝、严格分桶和只发布验证完成的衍生物；
- 生产公开投影只接受 `https://public-media.ditedog.com/prod/web/**`；原图、处理源、管理预览、其他环境前缀和原始 OSS URL 均 fail closed；
- 该访问边界不承诺清除终端已经下载或截图的副本。

### 8.2 查询参数

- 公开媒体 URL 不带业务鉴权参数；
- ESA 缓存规则忽略无业务意义的查询参数；
- `x-oss-process`、随机 nonce 和任意查询串既不能生成新像素，也不能制造不同源站请求。

### 8.3 缓存

- 不可变 Key 允许 ESA 节点长缓存；
- 浏览器缓存时间按不可变对象与下架需求配置，不与签名 TTL 绑定；
- ESA 出站响应头与节点缓存分别配置，不能误以为改浏览器头会改变节点缓存；
- 404 初始短缓存 60 秒，观察后调整；
- 媒体域名不得在源站 404/故障时继续提供已下架旧图片。

### 8.4 WAF、源站保护与用量

- ESA WAF/速率限制负责首版滥用控制；原始 OSS 私有、分桶和发布投影仍是媒体安全主边界；
- 正式套餐启用源站保护后，ECS 80 只允许 ESA 回源 IP，3000 始终只绑定 loopback；
- Free 套餐只用于开发/验证，不作为正式生产 SLA；套餐配额、预算和任何用量保护不能替代鉴权，并必须在 T53 当日控制台与目标环境实测后填写。

## 9. 发布、下架与恢复

### 9.1 发布

作品、返图、Hero 与站点入口继续：

1. 固化请求版本；
2. 生成缺失变体；
3. 验证衍生对象；
4. 原子切换业务状态/公开投影；
5. 写审计记录；
6. 失败只清理当前 attempt 新对象，旧公开版本持续可用。

正式环境的“验证可公开”改为：应用有权限读取/HEAD、对象身份完整、ESA 媒体 URL 能 200；不再要求原始 OSS 匿名 GET 200。

### 9.2 下架

1. SQLite 事务先撤销页面公开投影；
2. 固化精确 OSS Object Key 与 ESA File URL manifest；
3. 删除不再引用的衍生对象；
4. 调用 `PurgeCaches(Type=file)`；
5. 保存 ESA `TaskId`，使用 `DescribePurgeTasks` 查询；
6. 完成后收敛 operation；失败保留精确 manifest 和稳定 reason，可重试；
7. 重启恢复继续未完成的 OSS 清理/ESA purge，不重复改变已提交业务状态。

第 1 步完成后页面立即下架。已缓存 URL 的服务器侧撤销以 ESA purge task 完成为准，目标时间在 T53 warm-cache 实测后记录。UI 和审计必须区分“页面已下架”“ESA purge 中”“ESA 已撤销”“ESA 撤销失败”。

### 9.3 删除

- 清理只用精确 manifest，不列举前缀批量删除；
- 仍被其他投影/旧有效版本引用的对象不得删除；
- 删除返图设定先下架其已发布返图并完成媒体撤销，再删除记录；私有永久原图保留；
- 不建设通用回收站或统一 `deleted_at`。

## 10. 验收标准

### 已落地配方保持

- 首页/委托/入口无水印；
- 作品/领养/展会掉落使用活动水印；
- 返图 `return-display-v1` 无水印、原比例、EXIF 收敛；
- profile 切换不改变站点与返图身份；
- 横/竖/方图三视口无坏图、异常裁切或溢出。
- 作品竖版 `detail` 与 3:4 `work-card` 在所有响应式宽度保持单个居中水印，水印相对尺寸不随高分辨率档位缩小；设定图仍为左右双水印。
- 管理端触发的大文件预处理、Hero/设定图/出厂照适配和处理重试均显示 FFmpeg 动态等待进度、阶段与已等待时间；不伪造静态图连续百分比，也不阻塞状态轮询。

### 阶段 E 媒体开发门禁

- 稳定 ESA URL、公开 DTO/SSR、下架 purge、恢复和日志脱敏全部实现；
- preflight、环境 Schema、production verify、Compose/ops 与 Handbook 命令完整；
- ESA 媒体访问、原始 OSS 拒绝、Endpoint、缓存参数、失败/重启在受控环境通过；
- T49/T50 在同一 SHA 复核后才能签署 GATE-E。

### 阶段 F 目标环境门禁

- 两只原始 OSS Bucket 域名匿名 GET 均为 403；
- 已发布 ESA 媒体 URL 200，未发布/已撤销对象不可读；
- 公开 HTML/DTO 只有 ESA URL，不含 OSS 域名或私有 Key；
- 浏览器上传 URL 为公网私有 Bucket 域名，ECS 服务端使用杭州内网 Endpoint；
- 网页衍生 Bucket 内容抽样与数据库公开身份一致，私有原图不出现在该 Bucket；
- 随机 query 与 `x-oss-process` 不产生新缓存/回源像素；
- warm 后下架：页面立即隐藏，精确 ESA purge 完成后旧 URL 不再由边缘返回，并记录实际用时；
- ESA purge 失败/进程中断/重复重启保持唯一业务终态并可恢复；
- 日志、错误、审计和 artifact 不含 AK/SK、原始 OSS 签名 URL 或私有 Object Key；
- Handbook 的权限、CORS、缓存、封顶、预算、监控与回滚证据齐全。

## 11. 文档去重

本文是媒体公开与保护唯一事实源。当前 ESA 依据见 [`../planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](../planning/ESA-PRODUCTION-DECISION-2026-08-09.md)，阶段 F 人工步骤见 [`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。历史 T10/T14–T36 notes 对当时 public-read 行为有效，但不能覆盖本策略的阶段 E 实现/阶段 F 执行契约。
