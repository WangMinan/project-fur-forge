# 产物索引

> **当前阶段**：阶段 D 已由用户验收；阶段 E/F 的计划与上线资料已建立，工程尚按 TASKS 推进。

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

- 用户生产决策：[`../implementation/notes/stage-e/STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md`](../implementation/notes/stage-e/STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md)；
- 阿里云官方调研：[`../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](../planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)；
- 上线前 Handbook：[`../implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](../implementation/PRODUCTION-LAUNCH-HANDBOOK.md)；
- 重写后的生产 OSS 预检契约：[`../implementation/OSS-PREFLIGHT.md`](../implementation/OSS-PREFLIGHT.md)；
- `.env.example` 与 `.env.compose.example` 的 Endpoint 场景说明。

这些是实施契约，不代表阿里云控制台、代码、Bucket ACL 或生产环境已经切换。

## 后续待产物

| 任务 | 产物 |
| --- | --- |
| T46 | 第一方事件模型、采集/聚合 API、后台统计页、隐私说明和门禁 |
| T49 | 同一 SHA 全绿的 CI 证据与新的综合独立 Review |
| T50 | 管理/公开 Host、三视口、媒体与失败恢复的最终 E2E 证据 |
| T51 | 公开导航“有点小狗”、备案/页脚/SEO 字段和证书前置 |
| T52-F1–F7 | 配置拆分、Bucket 私有化、CDN 鉴权/缓存/撤销、监控、部署/回滚/恢复演练 |
| T53 | 用户最终上线验收；实际上线后才可关闭发布门禁 |

## 证据边界

- 代码自测、独立 Review、用户验收和正式上线是四种不同证据；
- dated note 不覆盖活文档；
- 本地通过不等于远端 Actions 全绿；
- 控制台截图不得包含 Secret、完整签名 URL、私有对象键或个人信息；
- 发布前的逐条证据位置以 Handbook 为准。
