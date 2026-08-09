# 阶段 E/F 范围与生产决策（2026-08-09）

> **性质**：用户确认的范围决策记录。活契约仍以 SPEC、媒体策略、PLAN、TASKS 和 STATE 为准。
> **后续覆盖**：本文的生产技术事实继续有效；阶段归属已由 [`STAGE-E-F-BOUNDARY-2026-08-09.md`](./STAGE-E-F-BOUNDARY-2026-08-09.md) 调整为“产品与上线基线开发在 E，F 主要人工/远程执行并可补独立运维小脚本”。
> **TLS 后续决策**：宿主机 Nginx、app-only Compose 与 `acme.sh + dns_ali` 方案见 [`STAGE-E-TLS-DECISION-2026-08-09.md`](./STAGE-E-TLS-DECISION-2026-08-09.md)。

## 1. 阶段 E 取舍

- 保留并实施最小化第一方访问统计；
- 不实施邮件找回密码，继续使用已存在的离线单管理员重置命令；
- 不实施 CSV 导出中心；
- 不实施永久原图档案 UI；
- 不建设高级媒体恢复或批量运维 UI，低频操作继续使用受控 CLI 与运行手册；
- CDN 不再是可选性能优化，而是正式生产媒体安全与成本边界的一部分。

## 2. 生产 OSS 与 CDN

- 继续使用现有两只杭州 OSS Bucket，不新增生产/开发 Bucket；
- 用户允许直接修改当前 Bucket ACL，开发站因此暂时不可用可以接受；
- 不保留旧匿名 OSS URL 的前向兼容，不建设双读或灰度兼容层；
- 两只 Bucket 都改为 `private`，并在 Bucket 级开启 Block Public Access；
- 私有 Bucket 保存永久原图、处理源、Logo 候选和管理预览；
- 衍生 Bucket 只保存已经生成和验证的网页衍生物；
- CDN 对衍生 Bucket 使用同账号私有 OSS 回源；用户接受 CDN 因而可读取该 Bucket 全部对象，严格的 Bucket 内容隔离是对应安全边界；
- 公开网页只返回 CDN 签名 URL，不再返回永久有效的 OSS URL；
- URL 鉴权有效期约一天，目标值为 `86400` 秒；
- 下架先立即撤销页面投影，再对精确 CDN URL 执行 `Force=true` 强制刷新；用户接受 CDN 服务器侧撤销通常约 5～6 分钟完成；
- 分享、长期公开 URL、海报和二维码留到未来阶段统一设计。

## 3. Endpoint 与凭据

- 杭州 ECS 上的服务端 OSS SDK 使用 `https://oss-cn-hangzhou-internal.aliyuncs.com`；
- 本地开发机和浏览器不能使用内网 Endpoint：本地服务端继续用杭州公网 Endpoint，浏览器条件 PUT 使用私有 Bucket 的杭州公网域名；
- 访客媒体只使用 CDN 域名；
- `.env`、`.env.example`、`.env.compose.example`、`config/runtime.example.json`、部署文档、生产校验和 OSS preflight 必须保持同一语义；
- 当前**应用** OSS/CDN AK/SK 方案保持不变，不在本阶段引入 ECS RAM Role、STS 客户端上传或新的应用密钥托管依赖；宿主机 ACME 的 DNS-only RAM Key 按后续 TLS 决策独立处理；
- AK/SK 仍只进入服务端运行环境，不进入仓库、镜像、前端、日志或证据。

## 4. 备案与品牌

- ICP 备案仍在审批中，预计下周得到结果；正式中国内地 CDN 域名接入必须等待备案同步完成；
- 备案网站名称为“有点小狗”；
- 公开桌面导航、移动导航以及复用该导航壳的登录页，中文导航品牌必须精确显示“有点小狗”，不能显示“有点小狗工作室”；
- 该决定只改变导航品牌，不自动改写作品主人显示、服务条款、版权归属、工作室介绍或其他已经确认的业务正文；这些字段需分别确认后才能修改。

## 5. 仍待上线时填写

- 正式公开、管理、媒体三个域名；
- ICP 备案号与公安备案信息；
- URL 鉴权主/备 Key（仅保存在阿里云和生产 Secret 中）；
- 基于目标环境实测峰值和月度预算确定的 CDN 用量封顶数值。
