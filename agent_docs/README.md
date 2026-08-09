# agent_docs

本目录是项目的 spec-driven 工作区。当前唯一活动需求为 [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)。

## 权威顺序

1. `foundation/README.md`：产品边界；
2. `requirements/SPEC.md` 与 `requirements/MEDIA-PUBLICATION-POLICY.md`：业务和媒体契约；
3. `planning/PLAN.md`：技术路线与实施顺序；
4. `.design/`：当前公开端与管理端体验；
5. `implementation/TASKS.md`：唯一任务和勾选权威；
6. `STATE.md`：当前阶段、阻断项和下一步。

`models/README.md` 是实施投影；`materials/`、历史原型、dated notes、旧 Review 和截图只能说明当时事实。`planning/FUTURE-ITERATIONS.md` 不是实施授权。

## 当前状态

截至 2026-08-09：

- 阶段 C/C.1 已完成；
- 阶段 D 的返图与展会掉落已落地，并由用户完成浏览器人工验收；
- 阶段 E 执行所有剩余产品与上线基线开发：统计、品牌/备案展示、生产 Bucket/CDN 能力、app-only Compose + 宿主机 Nginx/acme.sh 部署/恢复基线、CI、独立 Review 和最终回归；
- 阶段 F 主要由用户和远程开发机填写真实参数、操作阿里云控制台、部署冻结镜像、演练和验收；允许按实际运维需要补充不进入发布镜像的小型运维脚本；
- GitHub Actions 的既有失败由 T49 在同一 SHA 上关闭，当前不得描述为全绿。

下一步及依赖以 [`需求1-兽装工作室主页/implementation/TASKS.md`](./需求1-兽装工作室主页/implementation/TASKS.md) 为准。

## 已锁定的生产媒体方向

- 复用现有私有源图 Bucket 与公开衍生图 Bucket；正式切换时两者都设为 private，并开启 Block Public Access；
- 公开衍生图由 CDN 私有 OSS 回源读取，浏览器只获得约 24 小时有效的 CDN 鉴权 URL；
- 下架后页面立即移除，服务端对精确 CDN URL 发起强制刷新，目标约 5～6 分钟完成边缘撤销；
- 同地域 ECS/Nitro 服务端访问 OSS 使用杭州内网 Endpoint；本机、浏览器、CDN 回源和外部运维不能误用内网 Endpoint；
- 当前继续使用静态 AK/SK，不在本阶段引入实例 RAM 角色；
- 应用 AK/SK 与宿主机 ACME 凭据分离：复用现有 `acme.sh + dns_ali`、Let's Encrypt DNS-01、root cron 和稳定证书路径；不改用 Certbot 或 `nginx-module-acme`；
- Compose 唯一常驻服务是 Nuxt/Nitro app，端口固定只绑定 `127.0.0.1:3000`；Nginx 独立安装在宿主机，媒体域名 TLS 在阿里云 CDN 终止；
- 公开导航品牌固定为“有点小狗”，不带“工作室”。

阿里云依据与逐项操作入口：

- [`需求1-兽装工作室主页/planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](./需求1-兽装工作室主页/planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)；
- [`需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](./需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md)。

## 执行纪律

- 所有写入在最新 `main` 串行完成，不创建功能分支或 PR；
- 后端 → 前端 → 新上下文独立 Review → 用户验收；同一实现者不得为自己代签 Review；
- 不删除或清空 `.env`，不重写已执行迁移；
- 只运行与改动风险相称的测试，真实 OSS/E2E 会产生费用；
- 在 GATE-E 与 T53-F1～F5 完成前，不得声称正式发布就绪；F 中若需要改应用代码或冻结契约，必须返回 E 并重跑冻结门禁。
