# 产物索引

> **当前阶段**：阶段 D 已由用户验收；阶段 E 将完成全部剩余产品/上线基线开发并冻结上线产物，阶段 F 主要由用户和远程开发机执行，并可受控补充独立运维小脚本。

## 活文档

- [`../STATE.md`](../STATE.md)；
- [`../requirements/SPEC.md`](../requirements/SPEC.md)；
- [`../requirements/MEDIA-PUBLICATION-POLICY.md`](../requirements/MEDIA-PUBLICATION-POLICY.md)；
- [`../planning/PLAN.md`](../planning/PLAN.md)；
- [`../implementation/TASKS.md`](../implementation/TASKS.md)；
- [`../implementation/EXECUTION_ROUTING.md`](../implementation/EXECUTION_ROUTING.md)。

## 已交付工程基线

### 阶段 A–C/C.1

- Nuxt 4 全栈、SQLite/Drizzle、单管理员认证与 Host/Origin/CSRF 边界；
- 私有直传、媒体处理、发布/下架、operation lease/heartbeat/recovery；
- 作品、领养、首页、委托、固定文案、品牌水印；
- 双 Bucket、部署文件、备份/恢复入口、生产镜像依赖闭包；
- 作品 `recipe-v2`，站点大图 `site-display-v1`。

### 阶段 D

- `return_characters` + `return_photos` 两级模型；
- 设定多图、圆形主图、可选作品关联、设定级私有授权；
- 无水印 `return-display-v1`、独立 `/returns` 随机瀑布流和设定页；
- 复用 adoption 的 `event_drop`、公开筛选、展会名称/时间；
- 发布时间倒序、首页精选独立排序、固定 10 秒轮播；
- 用户验收记录：[`../implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](../implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。

T35–T37 尚无独立 Review 签署；该门禁并入 T49，不能用用户验收替代。

## 阶段 E/F 已完成的文档产物

- 用户生产决策：[`../planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](../planning/ESA-PRODUCTION-DECISION-2026-08-09.md)；
- 阶段边界调整：[`../implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md`](../implementation/notes/stage-e/STAGE-E-F-BOUNDARY-2026-08-09.md)；
- 当前 ESA 生产方案：[`../planning/ESA-PRODUCTION-DECISION-2026-08-09.md`](../planning/ESA-PRODUCTION-DECISION-2026-08-09.md)；
- 服务器 ESA/HTTP-origin 切换记录：[`../implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md`](../implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md)；
- ESA/宿主机切换证据：[`../implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md`](../implementation/notes/stage-e/T52-ESA-INFRASTRUCTURE-TRANSITION-2026-08-09.md)；
- 上线前 Handbook：[`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md)；
- 重写后的生产 OSS 预检契约：[`../implementation/OSS-PREFLIGHT.md`](../implementation/OSS-PREFLIGHT.md)；
- `.env.example` 与 `.env.compose.example` 的 Endpoint 场景说明。

这些是实施契约，不代表阿里云控制台、代码、Bucket ACL 或生产环境已经切换。

## 阶段 E 已交付工程产物

- T46 第一方统计：迁移、最小事件仓储/服务/路由、公开最佳努力采集、管理端只读概览和隐私/失败路径门禁；证据见 [`../implementation/notes/stage-e/T46-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T46-ENGINEERING-2026-08-09.md)；
- T51 品牌/备案能力：公开导航短品牌、严格备案配置与空值隐藏、页脚投影、确定性品牌衍生复核和 tracked 素材审计；证据见 [`../implementation/notes/stage-e/T51-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T51-ENGINEERING-2026-08-09.md)。
- T51-F1 用户反馈修复：`/works` 紧凑间距、低分辨率设定图非阻断上传/发布、私有 FFmpeg Lanczos 适配源、明确中文失败恢复和自动/真实浏览器证据；证据见 [`../implementation/notes/stage-e/T51-F1-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T51-F1-ENGINEERING-2026-08-09.md)。
- T51-F2 公开列表分页：`/works` 固定 12 件、`/adoptions` 固定 8 个，筛选后服务端分页、单页仍显示编号栏、非法/越界页码受控，以及三视口真实浏览器证据；证据见 [`../implementation/notes/stage-e/T51-F2-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T51-F2-ENGINEERING-2026-08-09.md)。
- T52-E1 Endpoint/配置：服务端 OSS、浏览器条件 PUT 与 ESA 公开媒体三类地址分离，ESA Site/API Endpoint 显式配置，生产 Schema、环境/runtime 模板和 production verify 同步；2026-08-10 又按用户真实部署收敛为 OSS/ESA API 共用现有 AK/SK；证据见 [`../implementation/notes/stage-e/T52-E1-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T52-E1-ENGINEERING-2026-08-09.md) 与 T52-E6 follow-up。
- T52-E2 OSS/ESA preflight：默认无网络 dry-run、显式 live 探测、Bucket/对象/衍生物数据库边界、上传失败面、原站/ESA 读取、共享阿里云凭据的官方 SDK purge 业务能力与脱敏证据；证据见 [`../implementation/notes/stage-e/T52-E2-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T52-E2-ENGINEERING-2026-08-09.md)，2026-08-10 的凭据收敛见 T52-E6 follow-up。
- T52-E3 ESA 公开投影：生产公开媒体只接受 `public-media` 的 `prod/web/**`，公开 SSR/API 泄漏扫描、网页衍生物 fail-closed 门禁、H3 直接依赖闭包和生产产物验证同步；证据见 [`../implementation/notes/stage-e/T52-E3-ENGINEERING-2026-08-09.md`](../implementation/notes/stage-e/T52-E3-ENGINEERING-2026-08-09.md)。
- T52-E4 ESA 缓存与撤销：机器可校验缓存基线、精确 file purge、URL/TaskId/边缘状态持久化、失败重试/启动恢复、作品/返图/Hero 管理反馈和正式输出依赖闭包；证据见 [`../implementation/notes/stage-e/T52-E4-ENGINEERING-2026-08-10.md`](../implementation/notes/stage-e/T52-E4-ENGINEERING-2026-08-10.md)。
- T52-E5 ESA 安全/可观测性：源站保护/WAF、流量/费用/错误/purge/证书/源站/应用/SQLite 告警契约，生产测量入口、宿主机验证和脱敏证据模板；证据见 [`../implementation/notes/stage-e/T52-E5-ENGINEERING-2026-08-10.md`](../implementation/notes/stage-e/T52-E5-ENGINEERING-2026-08-10.md)。
- T52-E6 部署基线：app-only Compose、目标机 Nginx 1.30.4 HTTP-only 配置、同镜像一次性运维命令、镜像摘要/备份/恢复/回滚与直接面向部署人的顺序清单；实现 SHA `fcb99f4` 的 Actions run `31329958587` 中 `checks`、`image-build`、`e2e` 全部成功；证据见 [`../implementation/notes/stage-e/T52-E6-ENGINEERING-2026-08-10.md`](../implementation/notes/stage-e/T52-E6-ENGINEERING-2026-08-10.md)。

以上工程自测均不代签 T49 独立 Review；T52-E2/E3 尚未在生产凭据/Bucket 上执行 live 模式，T52-E4 尚未在目标环境实测控制台缓存与 warm-cache 撤销时间；T46 最终隐私文案与 T51 正式素材选择仍由用户确认。

## 后续待产物

| 任务 | 产物 |
| --- | --- |
| T49/T50/GATE-E | 同一 SHA CI、独立 Review、最终回归与上线产物冻结 |
| T53-F1～F5 | 用户参数、阿里云控制台、远程机部署、正式验证和最终验收 |

## 证据边界

- 代码自测、独立 Review、用户验收和正式上线是四种不同证据；
- dated note 不覆盖活文档；
- 本地通过不等于远端 Actions 全绿；
- 控制台截图不得包含 Secret、原始 OSS 签名 URL、私有对象键或个人信息；
- 发布前的逐条证据位置以 Handbook 为准。
