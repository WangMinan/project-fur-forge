# OSS/CDN 生产预检契约

> **角色**：定义阶段 E 的 T52-E2 必须实现并验证、阶段 F 的 T53-F2/F3 负责运行并可在不改变判定契约的前提下补充诊断包装器的可重复自动预检。
> **最后校准**：2026-08-09。
> **重要**：当前 `scripts/oss-preflight.mjs` 仍按历史 public-read 衍生 Bucket 设计，必须在 T52-E2 重写并在 GATE-E 冻结后才能作为阶段 F 门禁。阶段 F 可另补诊断/证据采集包装器，但不得放宽或替换该门禁；本文不声称现有脚本已经满足。

## 1. 固定拓扑

| 项目 | 目标 |
| --- | --- |
| Region | `oss-cn-hangzhou` |
| 生产服务端 Endpoint | `https://oss-cn-hangzhou-internal.aliyuncs.com` |
| 本地服务端 Endpoint | `https://oss-cn-hangzhou.aliyuncs.com` |
| 浏览器上传 | 私有 Bucket 杭州公网域名 |
| 私有原图 Bucket | 现有 Bucket，ACL private，Bucket BPA 开启 |
| 网页衍生 Bucket | 现有 Bucket，ACL private，Bucket BPA 开启 |
| 公开媒体 | CDN 媒体域名 + URL 鉴权方式 A |
| CDN 回源 | 只回源衍生 Bucket，同账号私有回源 |

不创建新 Bucket，不兼容旧 public-read URL。两只原始 OSS 域名匿名访问都必须失败。

## 2. 应用最小权限

现有应用 RAM 身份继续使用当前 AK/SK，只允许：

- 读取必要 Bucket 信息/CORS/BPA 状态；
- 对私有 Bucket 的单一生产原图/处理前缀执行需要的 Put/Get/Delete/Process；
- 对衍生 Bucket 的单一生产网页前缀执行需要的 Put/Get/Delete；
- CDN 对正式媒体域名执行 `RefreshObjectCaches`、`DescribeRefreshTasks`、`DescribeRefreshQuota`。

不授予 `oss:*`、`AliyunOSSFullAccess`、`AliyunCDNFullAccess`、无界 List 后批量删除或 CDN 域名/计费修改权限。

具体 RAM JSON 在实现时根据阿里云资源级授权能力生成并用越权负测试验证；示例不能替代控制台实际授权结果。

官方参考：

- [CDN 自定义权限策略](https://help.aliyun.com/zh/cdn/user-guide/authorize-a-ram-user-to-prefetch-and-refresh-resources/)
- [CDN 私有 OSS 回源](https://help.aliyun.com/zh/cdn/user-guide/grant-alibaba-cloud-cdn-access-permissions-on-private-oss-buckets)

## 3. 秘密放置

- AK/SK、Session Secret、CDN URL 鉴权主/备 Key只进入本机/生产受控 Secret；
- 不进入仓库、镜像、`runtimeConfig.public`、前端构建、日志、证据、测试快照或聊天；
- 预检只记录“已设置”布尔值、脱敏状态码/Request ID、摘要和任务状态；
- 完整 OSS/CDN 签名 URL 不落盘到证据；
- `.env` 不删除/清空；生产 `.env` 与本地 `.env` 分场景维护。

## 4. 配置门禁

预检先验证：

- `OSS_REGION=oss-cn-hangzhou`；
- 生产 `OSS_ENDPOINT` 精确为杭州 internal；本地模式精确为杭州 public；
- `OSS_UPLOAD_BASE_URL` 是私有 Bucket 公网 HTTPS origin 且不含 `-internal`；
- `MEDIA_BASE_URL` 是 CDN HTTPS origin，不是 `.aliyuncs.com` OSS Bucket 域名；
- 私有/衍生 Bucket 名不同；
- 公开、管理、媒体、上传 origin 互不相同；
- OSS 与 Session/CDN 鉴权配置完整成组；
- 浏览器条件 PUT 实际返回 URL Host 与 `OSS_UPLOAD_BASE_URL` 语义一致，不能只检查变量存在。

同步入口：生产 `.env`、`.env.example`、`.env.compose.example`、`config/runtime.example.json`、runtime Schema/测试、production verify 与 `docs/DEPLOYMENT.md`。

## 5. Bucket 与对象权限门禁

对两只 Bucket：

1. Region/Endpoint/账号匹配；
2. Bucket ACL 为 private；
3. Bucket 级 Block Public Access 开启；
4. 无公共 Bucket Policy；
5. 抽样对象不存在 public-read/public-read-write ACL；
6. 原始 Bucket 域名匿名 GET 403；
7. 应用身份精确前缀读写成功；越过前缀/角色/环境失败。

对衍生 Bucket 额外检查：

- 对象都可从数据库追溯到 `asset_variants` 的网页用途；
- 不包含原图、processing、Logo、预览或授权附件；
- CDN 只回源该 Bucket。

官方参考：[Block Public Access](https://help.aliyun.com/zh/oss/user-guide/block-public-access/)、[Object ACL](https://help.aliyun.com/zh/oss/user-guide/object-acl)。

## 6. CORS 与条件 PUT

私有 Bucket 最小 CORS：

- Allowed Origin：正式管理 HTTPS origin；
- Allowed Method：`PUT`；
- Allowed Headers：`content-type`、`content-md5`、`x-oss-meta-sha256`、`x-oss-forbid-overwrite`；
- Expose Headers：`ETag`、`x-oss-request-id`。

衍生 Bucket 不配置浏览器上传 CORS。

预检从真实管理 origin：OPTIONS 通过；V4 条件 PUT 成功；Content-Type/MD5/SHA/forbid-overwrite 任一篡改失败；重复 Key拒绝；完成后服务端 HEAD/摘要/MIME/尺寸/EXIF/角色重验通过。

## 7. 媒体处理与存储职责

- 永久原图不超过 30,000,000 字节、最大边 12,000 px；
- 超过 OSS 图片处理输入限制时生成私有 FFmpeg 处理源；
- 公开衍生写入衍生 Bucket，使用完整不可变身份与 Cache-Control；
- 作品/领养/掉落水印，站点/返图无水印；
- 公开文件 EXIF 收敛；
- 私有源摘要前后不变；
- 清理只按本次内存/数据库精确 Key 反序执行，不 List 前缀后删除。

## 8. CDN 门禁

### 私有回源

- 有效 CDN URL 访问 READY 衍生对象返回 200；
- 同一路径原始 OSS URL 匿名返回 403；
- CDN 无法读取私有原图 Bucket；
- 缺少/过期/篡改 URL 鉴权返回 403。

### 查询与缓存

- URL 鉴权先执行；
- 随机 query 命中同一缓存身份；
- `x-oss-process` 不传源站、不产生新像素；
- 浏览器缓存不超过 86400 秒；
- 媒体响应过期缓存关闭；
- 404 短缓存生效。

### 下架刷新

1. 预热专用测试对象；
2. 撤销页面投影；
3. 删除精确衍生对象；
4. `RefreshObjectCaches`：`Force=true`、`ObjectType=File`；
5. 保存任务 ID并查询到 Complete；
6. 通常 5～6 分钟目标窗口后旧 URL 不能继续返回图片；
7. 模拟 API 失败与进程中断，operation 保留 manifest并可恢复。

官方参考：[URL 鉴权](https://help.aliyun.com/zh/cdn/user-guide/configure-url-signing/)、[忽略参数](https://help.aliyun.com/zh/cdn/user-guide/ignore-parameters/)、[刷新缓存](https://help.aliyun.com/zh/cdn/user-guide/refresh-and-prefetch-resources)。

## 9. 执行与证据

T52-E2 必须更新现有 `pnpm preflight:oss` 或提供同一受控入口，并在 GATE-E 前冻结具体命令、参数、判定与预期结果。在此之前不要运行旧脚本并把 public-read 结果记为新门禁通过；阶段 F 运行冻结入口，必要时只补不改变判定的诊断包装器。

证据只保存：

- 配置场景/Host 分类；
- Bucket ACL/BPA/CORS 的脱敏结论；
- 匿名/授权/越权状态码；
- 输入/输出摘要和尺寸；
- CDN 有效/无效鉴权结果；
- refresh 任务 ID 的脱敏值/状态/耗时；
- 清理完成数量与 404 结果。

完整人工顺序见 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md)。
