# 当前状态

> **最后校准**：2026-08-09。
> **状态权威**：任务勾选以 [`implementation/TASKS.md`](./implementation/TASKS.md) 为准。

## 当前阶段

阶段 C/C.1 已完成。阶段 D 的返图、轻量展会掉落和两轮修复已落地并推送；用户于 2026-08-09 关闭 T42 人工验收，阶段 D/E 独立综合 Review 保留到 T49。

当前为：

> **阶段 E · 全部产品/上线基线开发、自动化门禁与可上线代码冻结。T51-F1 工程完成；下一项：T52-E1。**

阶段 E 包含所有剩余应用代码、数据库迁移、运行时配置 Schema、媒体/CDN 核心实现、部署/恢复基线、app-only Compose 与宿主机 Nginx/ACME 兼容模板、自动化测试、浏览器回归和独立 Review。阶段 E 结束时必须形成唯一、不在阶段 F 改写的上线 SHA/镜像。

阶段 F 主要由用户和远程开发机执行：填写真实环境值、操作阿里云控制台、部署冻结镜像、演练恢复/回滚、做正式域名验收并签署。为适配实际运维，可以新增或调整独立小型运维脚本及其最小测试/文档；脚本不得改变应用代码、数据库 Schema、公开契约、运行时配置契约或冻结镜像。

本次边界调整见 [`implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md`](./implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md)。

## 已完成产品基线

- 独立公开端与管理端、Host/Origin/CSRF/Session 安全边界；
- 作品、领养、展会掉落、返图设定与多照片；
- 首页、委托、关于/政策/许可证、固定文案和品牌水印；
- 私有原图、公开衍生图、持久 operation 和恢复；
- Node 24、SQLite/Drizzle、Docker/Compose/Nginx 基础；
- 阶段 D 用户浏览器验收。

阶段 D 用户门禁见 [`implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](./implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。

T46/T51/T51-F1 已完成迁移或无迁移应用实现、相关自动测试和本地真实浏览器回归；工程证据见 [`implementation/notes/stage-e/T46-ENGINEERING-2026-08-09.md`](./implementation/notes/stage-e/T46-ENGINEERING-2026-08-09.md)、[`implementation/notes/stage-e/T51-ENGINEERING-2026-08-09.md`](./implementation/notes/stage-e/T51-ENGINEERING-2026-08-09.md) 与 [`implementation/notes/stage-e/T51-F1-ENGINEERING-2026-08-09.md`](./implementation/notes/stage-e/T51-F1-ENGINEERING-2026-08-09.md)。这不是 T49 独立 Review，也不关闭 T46 隐私文案或 T51 正式素材的用户确认项。

## 阶段 E 已锁定范围

1. **T46**：最小化第一方访问统计；
2. **T51**：公开导航“有点小狗”、备案展示配置、正式素材和浏览器校准；
3. **T52-E1～E6**：Endpoint/配置、preflight、CDN signer、下架刷新、成本/监控准备，以及 app-only Compose + 宿主机 Nginx/acme.sh 远程部署包；
4. **T49**：同一 SHA CI 全绿与阶段 D/E 新上下文独立综合 Review；
5. **T50**：代码冻结前全站、媒体、进程、部署和恢复最终回归；
6. **GATE-E**：冻结唯一上线 SHA/镜像、环境变量契约、Handbook 核心命令基线和回滚入口。

T43、T44、T45、T47 已取消；T48 调研完成。所有生产能力的开发工作都在 E 完成，不进入 F。

## 阶段 F 已锁定范围

阶段 F 只有 T53-F1～F5：

- **F1**：用户填写域名、备案、素材、应用 Secret、预算等真实参数，核对现有 ACME 邮箱/Key 的保存责任与轮换责任，并授权冻结镜像的发布/传送方式；
- **F2**：用户在阿里云控制台配置 CDN、OSS、应用 RAM、DNS/TLS、初始用量封顶和告警；ACME RAM 只核对现有权限，不满足最小权限时才调整或新建；
- **F3**：远程执行者先填写并校验生产 `.env`，再发布/传送、拉取/载入并核对冻结镜像摘要，随后部署唯一常驻 Nuxt 容器，复核现有宿主机 Nginx/acme.sh/dns_ali/证书/cron 并只补精确 Host、安全 reload 与监控，执行迁移、preflight、测量校准、备份/恢复和回滚；
- **F4**：正式域名做媒体安全、现有 TLS 证书/root cron/最近续期结果/安全 reload、loopback 隔离、三视口、业务操作、监控和恢复全链验证；
- **F5**：用户真实使用验收和证据闭环。

F 允许的仓库写入包括验收 note、证据索引、checkbox、STATE 状态同步，以及必要的独立运维脚本/包装器与最小验证。运维脚本应默认 dry-run、输出脱敏、目标明确、可回滚，并单独记录 commit 与验证结果；若需要改应用源码、迁移、运行时 Schema、环境变量契约、Dockerfile、Compose、Nginx/ACME 冻结模板、自动化产品测试或发布镜像，GATE-E 失效，必须返回阶段 E。

## 生产事实

### 品牌与备案

- 备案网站名称为“有点小狗”；
- 公开桌面/移动导航和复用公开壳的登录页精确显示“有点小狗”，不带“工作室”；
- 管理端、作品主人、工作室介绍、服务条款和 SEO 组织名称不机械全局替换；
- 阶段 E 实现空值隐藏和生产配置；阶段 F 才写入审批后的真实备案值。

### OSS 与 CDN

- 复用现有私有源图 Bucket 与网页衍生 Bucket，不创建额外生产 Bucket；
- 目标状态是两只 Bucket 均 private + Bucket 级 BPA；
- CDN 只私有回源衍生 Bucket，不能访问私有原图 Bucket；
- 公开页只下发约 `86400` 秒有效的 CDN 鉴权 URL；
- 下架页面立即移除，服务端对精确 URL `Force=true` 刷新，通常约 5～6 分钟完成 CDN 服务器侧撤销；
- 阶段 E 完成相关实现与自动验证；阶段 F 执行真实控制台切换和远程验证。

### Endpoint 与凭据

- 本机开发服务端：杭州公网 OSS Endpoint；
- 杭州远程机上的 app/migrate/ops：杭州内网 Endpoint；
- 浏览器条件 PUT：私有 Bucket 公网域名；
- CDN 回源：CDN 控制台的私有 OSS 源站；
- 公开图片：CDN 媒体域名；
- 应用继续使用现有静态 OSS/CDN AK/SK；宿主机 ACME 另用只含 DNS 记录查询/新增/删除权限的专用 RAM API Key，两者不得复用；
- ACME 的 `Ali_Key` / `Ali_Secret` 只保存在 root 限权的 acme.sh config-home，不进入应用 `.env`、Compose、容器、仓库、日志、截图或客户端。

### 宿主机 Nginx 与 TLS

- Nginx 独立安装在 ECS 宿主机并由 systemd 管理；Compose 唯一常驻服务是 Nuxt/Nitro app，migrate/ops 使用同一冻结镜像的一次性容器；
- app 端口固定只发布到 `127.0.0.1:3000`，安全组不开放 3000；宿主机 Nginx upstream 固定为该地址；
- 公开站与管理端复用宿主机现有 `acme.sh + dns_ali`、Let's Encrypt DNS-01 和 `ditedog.com` / `*.ditedog.com` ECDSA 证书；不改用 Certbot 或 `nginx-module-acme`；
- 复用现有每 6 小时执行 `acme.sh --cron` 的 root cron 和 `/etc/nginx/ssl/ditedog.com/` 稳定证书路径，不重装、不重签、不迁移为 systemd timer；T52-E6 只需让仓库部署契约兼容该基线，并把续期 reload 收紧为先 `nginx -t`；
- 通配符证书不等于通配符路由；正式 Nginx `server_name` 只列公开/管理精确域名，其他 Host/SNI 由默认 server 拒绝；
- 媒体域名在阿里云 CDN 终止 TLS，不由宿主机 Nginx 证书服务；DNS-01 本身不要求 80 端口或提前切 A 记录。

最终 TLS 决策见 [`implementation/notes/stage-e/STAGE-E-TLS-DECISION-2026-08-09.md`](./implementation/notes/stage-e/STAGE-E-TLS-DECISION-2026-08-09.md)。

## 任务状态

| 任务 | 状态 | 下一步 |
| --- | --- | --- |
| T42 | 用户门禁已关闭 | 独立 Review 移交 T49 |
| T43/T44/T45/T47 | 已取消 | 不建设 |
| T48 | 调研/契约完成 | 实现已纳入 T52-E1～E6 |
| T46 | 工程完成，用户文案确认待关闭 | T49 独立 Review；用户确认统计含义与最终隐私文案 |
| T51 | 工程完成，正式素材确认待关闭 | 用户选择正式素材/独立竖版 Hero；低分辨率设定图可自动适配，仅可因清晰度自愿替换 |
| T51-F1 | 工程完成 | T49 新上下文独立 Review |
| T52-E1～E6 | 待实施 | 全部生产能力开发 |
| T49 | 等待 E 开发完成 | 同一 SHA CI + 独立综合 Review |
| T50 | 等待 T49 | 最终回归与冻结证据 |
| GATE-E | 等待 T50 | 允许进入阶段 F |
| T53-F1～F5 | 等待 GATE-E | 用户与远程机执行 |

## 不阻断阶段 E 的用户输入

- ICP 审批结果、备案号与平台同步时间；
- 正式公开、管理、媒体三个域名；
- CDN URL 鉴权主/备 Key 的实际值；
- 核对现有 ACME 联系邮箱、DNS-only RAM 权限、Secret 可恢复位置与轮换责任；现有配置可用时不要求重新填写或重新签发；
- 月度预算和目标环境实测后的用量封顶数值；
- EXT-01 素材是否直接作为正式素材，以及替换项。

阶段 E 必须先把这些输入建成明确的配置槽、校验和空值行为，不能等待真实值才开发。真实值在 T53-F1 写入远程 Secret/环境，不进入仓库。

## GitHub Actions 已知边界

历史证据仍是：`image-build` 成功、`checks` 在 Production build 失败、`e2e` 跳过。T49 必须基于届时完成全部 E 开发的最新 `main`，在同一 SHA 重新取得完整结果。

## 下一步顺序

1. T52-E1～E6；
2. T49；
3. T50；
4. GATE-E；
5. T53-F1～F5。

## 当前发布边界

- 当前未取得正式上线结论；
- 阶段 E 不创建未授权 `v*` tag、不继续变更正式 DNS/ACL；用户已提前把 `ditedog.com A` 指向 ECS 并配置宿主机 TLS，这只记作预检现状，不视为阶段 F 或正式切换完成；
- 阶段 F 不修改冻结应用产物；仅允许受控补充独立运维脚本；
- 只有 GATE-E 和 T53-F1～F5 全部关闭后，才可声明“正式上线就绪”。
