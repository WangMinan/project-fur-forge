# 执行路由

> **最后校准**：2026-08-09。
> **边界**：阶段 E 完成所有产品与上线基线开发；阶段 F 主要由用户和远程开发机执行 Runbook，并可受控补充独立运维脚本。

## 1. 写入与 Review 纪律

- 所有代码、文档、测试和修复直接在最新 `main` 串行完成；
- 不建功能分支、不发 PR、不 force push、不硬 reset；
- 后端 → 前端 → 实现验证 → 新上下文独立 Review → 用户门禁；
- 同一实现者不得为自己的实现代签独立 Review；
- 首次 finding/NOT PASS 保留，修复后逐项重测；
- 不删除 `.env`，不重写已执行迁移，不放宽安全/隐私/媒体断言。

## 2. 阶段顺序

1. T46 统计；
2. T51 品牌/备案展示/素材；
3. T51-F1 用户反馈修复；
4. T52-E1～E6 生产能力开发；
5. T49 CI + 独立综合 Review；
6. T50 最终回归；
7. GATE-E 代码冻结；
8. T53-F1～F5 用户与远程机执行。

任务编号沿用历史，不代表 T49 必须早于 T51/T52；依赖以 TASKS 为准。

## 3. 阶段 E 角色

### BACKEND_PRIMARY

负责：

- T46 数据模型、清理、聚合、隐私和限流；
- T51 备案配置 Schema、服务端投影和空值行为；
- T51-F1 设定图私有 FFmpeg 适配源和 publication operation 恢复；
- T52-E1 运行时配置与 Endpoint 拆分；
- T52-E2 preflight；
- T52-E3 ESA 托管 STS 私有 OSS 回源边界与稳定媒体 URL；
- T52-E4 ESA purge operation/recovery；
- T52-E5 测量/诊断入口，以及 ESA 边缘证书、源站保护、流量/purge、Nginx reload 监控基线；
- T52-E6 ops、app-only Compose、宿主机 HTTP-only Nginx systemd 服务、ESA HTTP origin、备份/恢复/回滚；
- unit/integration/build/production verify。

默认 `BACKEND_PRIMARY`：GPT-5.6 Sol。

### FRONTEND_PRIMARY

负责：

- T46 管理统计页与公开最佳努力采集；
- T51 导航“有点小狗”、备案/页脚、正式素材和三视口；
- T51-F1 `/works` 紧凑间距、低分辨率设定图提示与真实发布流程；
- T52-E4 下架/刷新状态；
- T52 的公开 ESA SourceSet 与错误恢复体验；
- 浏览器、键盘、焦点、console/network 和 DTO 泄漏检查。

由用户在 Kimi K3、Claude Opus 5、GPT-5.6 Sol 中逐任务指定。

### REVIEW

T49 在新的独立上下文执行：

- 阶段 D 最终代码；
- T46/T51/T51-F1/T52-E1～E6；
- CI 同一 SHA、隐私、媒体、运行时配置、部署和回滚；
- 发现问题后由实现者修复，REVIEW 重测。

T50 是 GATE-E 前最后的浏览器/进程/部署回归。REVIEW 只能签“可以进入阶段 F”，不能提前签“正式上线就绪”。

## 4. 阶段 E 交付物

GATE-E 前必须交付：

- 唯一 commit SHA 与镜像摘要；
- 完整且经过校验的生产环境变量清单；
- 可直接运行的 migrate/preflight/init/backup/restore/recover/rollback；
- 不需现场修改的 app-only Compose、宿主机 HTTP-only Nginx/ESA 模板与 Handbook；
- 同一 SHA CI、独立 Review、三视口、媒体和恢复证据；
- 已知 follow-up 与明确回滚边界。

## 5. 阶段 F 角色

### 用户

负责提供/确认：

- 域名、备案、正式素材、OSS/ESA/媒体鉴权 Secret、正式套餐、预算和阈值；
- 阿里云控制台中的 OSS/ESA/应用 RAM、DNS/ESA 边缘 TLS/源站保护/告警配置，以及 wildcard DNS 收敛；
- GATE-E 冻结镜像发布/传送方式的明确授权；
- 危险动作的最终确认；
- 正式业务操作与最终验收。

### 远程开发机执行者

主要执行：

- 写远程生产 `.env`；
- 按用户授权和冻结入口发布/传送 GATE-E 镜像，远程拉取/载入后核对摘要；
- 复核宿主机 HTTP-only Nginx、关闭的 443 与已移除的 ACME/证书/续期调度；按冻结模板收紧精确 Host、安全 reload 与监控；
- 运行 Handbook 已列命令；
- 按实际需要在仓库中补充独立运维脚本及其最小测试/文档；
- 读取日志/健康/监控并保存脱敏证据；
- 按既有入口回滚。

不能：

- 在远程机热改应用源码、迁移、运行时契约、Dockerfile、Compose、Nginx/ESA 冻结模板或容器内文件；
- 创建仓库外临时修复后继续验收；运维补充脚本必须回到仓库、单独提交并做针对性验证；
- 把控制台“已提交”当作“已生效”；
- 把 Bucket 改回 public-read。

允许的 F 阶段运维脚本只限诊断/检查、备份恢复包装、日志/健康/证据采集等独立用途；不得进入或重建发布镜像，不得改变业务数据模型、公开行为、媒体安全契约或环境变量 Schema。默认 dry-run，副作用目标必须显式且可回滚；可同步最小脚本测试和 Runbook。

### Agent 在阶段 F

Agent 可以指导用户、解释输出、执行已授权的远程命令、整理脱敏证据、补充受控运维脚本和更新验收 notes/checkbox。Agent 不得把 F 扩大为产品开发阶段。

## 6. F 中发现问题

| 问题 | 处理 |
| --- | --- |
| Secret/域名/ACL/缓存等环境配置错误 | 留在 F，按 Handbook 修正并重验 |
| ESA DNS/origin/边缘证书、源站保护或 purge RAM 配置错误 | 留在 F，按冻结模板修正并重验，不扩大 RAM 权限 |
| 远程机缺少已约定目录/权限 | 按冻结部署前置修正环境，不改仓库 |
| 缺诊断、检查、备份/恢复包装或证据采集脚本 | 留在 F，受控补充并记录独立 commit/验证 |
| 应用源码、Schema、迁移、发布模板、产品测试或冻结契约缺陷 | 停止 F，回到 E 修复 |
| 运维脚本产生独立 commit、未改变镜像/冻结契约 | 留在 F，做脚本针对性 Review/验证并继续记录原发布 SHA |
| E 级修复产生新发布 commit/镜像 | T49、T50、GATE-E 全部重新执行 |
| 用户改变产品行为或公开契约 | 先更新 SPEC/PLAN/TASKS 并取得确认，仍归 E |

## 7. 证据与文档同步

阶段 E note 记录范围、迁移、首次失败、修复、命令、浏览器/云测试和独立 Review。

阶段 F note 记录脱敏控制台配置、远程命令结果、正式域名观察、恢复/回滚和用户签署；若补充运维脚本，还记录独立 commit、适用范围、dry-run/针对性验证和回滚说明。F 允许同步 STATE/TASKS/notes/artifacts 状态，但不能借“运维脚本”修改产品契约。
