# 当前评审记录

> **角色**：记录当前 SPEC、代码、部署文件、GitHub Actions 与任务状态之间的差异。
> **评审日期**：2026-08-07。
> **代码基线**：`3984b4f181d5a3071a119affae34c1088a53b6f9`；其后的提交为阶段迁移文档更新。
> **结论**：阶段 C 为 `PASS`；存在已明确后置的发布级 CI 技术债，不阻断阶段 D。

## 1. 总结论

阶段 C 主业务链、C.1 收口能力和用户浏览器人工验收已经完成，`GATE-C1` 通过。以下结论同时成立：

1. **阶段 C 产品与工程范围通过**：公开端、管理端、媒体保护、长任务恢复、三视口与用户人工核对均已形成证据；
2. **GitHub Actions 尚未全绿**：最新已核对运行中，`image-build` 成功，`checks` 在 Production build 失败，`e2e` 跳过；
3. **正式发布尚未就绪**：CI 全绿、正式域名、TLS、线上 Compose、升级、回滚与恢复演练仍待后续任务；
4. **阶段 D 可以开始**：上述发布级遗留统一移到 T49、T52，不再阻断返图墙 T35–T36。

用户验收与迁移决策见
[`../implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md`](../implementation/notes/t34-c1/T34-C1-USER-ACCEPTANCE-2026-08-07.md)。

## 2. 阶段 C 已确认有效的实现

以下能力应作为阶段 D 的稳定基线，不推倒重写：

- `protection_mode` 与 `site-display-v1`；
- 首页/委托 Hero 及两个业务入口的无水印 usage；
- 作品和领养展示位的活动水印；
- 首页聚合 DTO、统一业务入口和竖图详情布局；
- 文案分区 Card、分区版本、FAQ 稳定 ID 与 409 草稿保留；
- 稳定 API `reason` 和前端英文消息匹配清理；
- 过期上传主动清扫；
- 可信代理解析与按主体限流；
- publication/watermark/reconcile operation 的 attempt、lease、heartbeat、恢复和精确清理；
- `server/utils/{repository,service,runner,recipe,route}` 五层边界；
- readiness 的严格迁移数量、顺序、folderMillis 与 hash 校验；
- 容器运维命令、live/ready、Nginx 双 Host 和镜像发布流程骨架；
- 经 GitHub Actions 成功验证的 Node 24 runtime 镜像构建；
- 本地完整非 Docker 门禁、真实双 Bucket 9/9 和三视口浏览器证据；
- 用户对阶段 C 公开端与管理端的人工浏览器核对。

## 3. Finding 关闭与移交状态

### R-17 · 远端质量门禁 —— **移交 T49，不再阻断阶段 C**

阶段迁移时核对的 `quality` workflow run `31139795670` 基线为
`3984b4f181d5a3071a119affae34c1088a53b6f9`：

- `image-build` 成功；
- `checks` 的 lint、typecheck、unit、integration 成功；
- `checks` 在 Production build 失败；
- verify、secret scan、Compose 静态检查因此未执行；
- `e2e` 因 `needs: checks` 跳过。

现有 annotation 只有进程退出码，不能据此推断具体根因。旧文档中的“runner 未接单”不代表这次最新运行。

用户决定把该问题移到 T49。T49 必须以届时最新 `main` 重新复现并修复，不能把本次失败解释为通过，也不能把不同 SHA 的结果拼接为全绿。

### R-18 · 既有站点素材迁移 —— **已关闭**

迁移 0021、`media:reconcile-site-display` 和容器子命令覆盖启用首页 Hero、委托 Hero、首页委托入口和已发布常规领养入口。重复运行幂等、失败可重试、旧投影保留。真实双 Bucket 9/9 通过，profile 切换不改变站点展示 URL 与摘要。

### R-19 · 长任务重启恢复 —— **已关闭**

迁移 0020 为 operation 增加 attempt、lease、heartbeat、recovery reason 和必要重试时间。事务内抢占、OSS 前后心跳、提交 CAS、启动扫描接管或转可恢复失败已经覆盖作品、Hero、水印与 reconcile。

真实 SIGKILL 子进程测试覆盖生成、公开对象验证和数据库提交边界；重复重启幂等，旧有效公开版本持续可见。

### R-20 · 后端职责边界 —— **已关闭**

Hero、publication、watermark、variant repository 已抽出；recipe 层 SQL 归零；`server/utils` 以路径表达 repository、service、runner、recipe、route 五层。Nitro `server/routes` 与辅助 `server/utils/route` 保持分离。

### R-21 · 首页与文案产品边界 —— **已关闭**

首页顺序为 Hero → 精选作品 → 统一业务入口 → 当前领养。官方邮箱、QQ、抖音号与防诈骗提醒统一在 contact 分区 Card；首页设置不再提供第二套联系方式入口。

### R-22 · Readiness 迁移校验 —— **已关闭**

readiness 复用严格 migration state，同时比较数量、顺序、folderMillis 与 hash；旧 `/api/health` 不再无条件返回 ok，未就绪返回 503，且错误体不泄漏数据库路径、SQL 或栈。

### R-23 · Compose 网络与健康路由 —— **阶段 C 配置完成，正式验证移交 T49/T52**

Dockerfile、`docker-compose.yaml`、Nginx 双 Host、未知 Host 拒绝、app egress、live/ready 和运维子命令均已形成。镜像构建成功。

Compose 静态检查在最新失败运行中未执行到；正式域名、TLS、空数据卷、升级、回滚与恢复演练尚未完成。前者由 T49 关闭，后者由 T52 关闭。

### R-24 · 用户视觉与业务验收 —— **已关闭**

用户于 2026-08-07 明确确认已在浏览器中完成人工核对，并宣布阶段 C 开发任务人工 Review 完成。T26-F1、T27-F1、T30、T34、T34-F8 和 `GATE-C1` 据此完成。

该结论不等同于正式目标环境验收；正式环境仍由 T52、T53 收口。

## 4. 阶段 C 结论边界

阶段 C 的 `PASS` 表示：

- 当前需求范围内的产品能力已经实现；
- 关键媒体、安全、恢复与浏览器行为具备证据；
- 用户完成公开端和管理端人工核对；
- 项目可以进入下一阶段产品增强。

它不表示：

- GitHub Actions 已全绿；
- Production build 失败已经修复；
- E2E 已在最新远端运行成功；
- 正式域名、证书、HSTS 或 CDN 已配置；
- 线上 Compose、空卷初始化、升级、回滚和灾难恢复已经演练；
- Docker Hub 正式镜像已经发布；
- 站点已经可以直接对外宣布上线。

## 5. 阶段 D Review 重点

当前建议只授权返图墙 T35–T36。Review 必须重点检查：

- 返图与作品出厂照是不同媒体角色和公开用途；
- 返图永久原图和可选授权记录保持私有；
- 轻量水印有不可变身份，不使用客户端临时参数加工；
- 返图发布、下架、失败、重试与重启恢复沿用现有 operation 模型；
- 返图不改变作品自身发布状态；
- 管理端使用独立返图入口，公开端保持图片优先；
- 三视口、键盘、焦点、图片解码、减少动效和横向溢出；
- T38–T40 未经用户确认不得借返图墙之名提前实现。

## 6. 后续通过条件

### 阶段 D

T42 只验证用户最终保留的 D 范围。取消的任务必须从验收矩阵中明确移除。

### 阶段 E / T49

必须满足：

- 最新 `main` 的 Production build 失败被复现并修复；
- checks 后续 verify、secret scan 与 Compose 静态检查实际执行；
- `checks`、`image-build`、`e2e` 在同一个最新 SHA 成功；
- 没有通过删除测试或放宽类型、安全、媒体和 E2E 断言取得绿色状态。

### 正式发布 / T52–T53

必须完成正式域名、TLS、线上 Compose、备份、监控、升级、回滚、恢复演练，以及景宸真实使用验收和文档闭环。
