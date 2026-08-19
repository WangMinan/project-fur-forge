# agent_docs

本目录是 `project-fur-forge` 的 spec-driven 工作区。每个需求目录维护自己的地基、规格、模型、设计、计划、任务、状态、实施记录和评审证据。后续需求只在明确条款上覆盖旧行为；未覆盖的安全、媒体、隐私和部署基线继续继承。

## 当前需求

- [`需求1-兽装工作室主页/`](./需求1-兽装工作室主页/)：已落地的双 Host、私有媒体、OSS/ESA、安全、发布、恢复和部署基线。
- [`需求2-站点导航与内容增强/`](./需求2-站点导航与内容增强/)：二维码媒体链、名称搜索等历史增量；五平台、返图、FAQ 和最新动态等行为已被后续需求覆盖。
- [`需求3-站点业务简化与委托投递/`](./需求3-站点业务简化与委托投递/)：当前已实现的业务基线，包括 `DITE DOG`、退役内容、Hero 横竖集合、简化作品/领养和私密委托投递。
- [`需求4-站点视觉升级与内容合规/`](./需求4-站点视觉升级与内容合规/)：**当前活跃需求**。先统一行动/上传/长任务进度并减轻测试体系，再修正领养排序、轻量申请确认、人工单条删除、Hero 管理和首页四幕。

## 需求4明确覆盖

### 组件、进度与测试

- 公开行动收敛为 primary/secondary/text；管理端行动使用统一 primitive；
- OSS 上传显示真实字节百分比；FFmpeg 使用阶段 + elapsed；持久 operation 使用真实阶段/计数，不显示伪百分比；
- Hero、作品、二维码、水印等耗时操作复用统一进度组件；
- 测试改为稳定不变量 core、少量主流程 smoke、显式 release 验证和迁移期 legacy；
- 默认 Actions 在实现阶段减重，不再让普通改动自动执行镜像/恢复/完整历史 E2E；
- 公开视觉、真实图片、动效和文案由王旻安/景宸人工验收，自动化不代签；
- 不新增 GitHub required check。

### 视觉和首页

- 首页继续覆盖完整核心业务，固定为“品牌 Hero → 代表作品 → 自设委托 → 设定领养”四幕；
- 首页设定领养只完整展示一项 `available`，无开放项时隐藏；
- `/adoptions` 永远 available 在前、adopted 在后，组内按 `updated_at DESC`；
- PC Web 为第一视觉基准，移动端同步做等价重排；
- 风格为“简洁底盘 + 灵动角色感”：允许有因的遮罩、错峰、聚焦和一次轻回弹，不做持续噪声；
- Hero 横版/竖版素材与四集合继续独立，后台只重组 placement/orientation 心智；
- Hero 焦点复用现有 `assets.focal_x/focal_y`，首版只提供九宫格。

### 委托、隐私和条款

- 站内表单负责结构化投递；官方 QQ 私聊负责优先后续沟通和逐单确认；邮箱备用；QQ群不是默认订单确认渠道；
- 申请页只增加两个未预勾选确认：成年/设定权利、隐私已读并理解提交不等于接单；
- 服务端严格校验两个 literal true，但不新增处理者字段、metadata API、contract version、确认 DB 列、客户端版本握手或 legacy/v2 UI；
- 实际经营主体名称通过现有隐私政策编辑能力人工写入；
- 个人信息和私有设定图按业务、保修、争议和法律必要期限保存；
- 人工决定清理时机，受控 CLI 每次精确删除一条申请并完成 DB/OSS 一体清理；不建设自动定时任务或时间批量删除；
- 网站服务条款是一般规则；具体价格、付款、排期、修改和特殊约定在官方 QQ 中逐单确认；接单或收款前由工作室在 QQ 中提供或明确引用当时条款并提示重大事项。

### 第三方声明

- npm 生产依赖声明从实际 lockfile/安装结果确定性生成；
- FFmpeg 在自有服务器容器内运行，但当前 release workflow 把包含它的镜像发布到公开 Docker Hub；按二进制分发场景记录精确版本/摘要、许可证、对应源码、补丁与构建信息；
- Noto Serif SC 按 SIL OFL 1.1；
- 拙黑拼贴体来自 Lemi Font 免费商用声明，作为第三方授权字体留档，不误称开源。

## 需求4权威顺序

编码前按以下顺序阅读：

1. [`需求4-站点视觉升级与内容合规/STATE.md`](./需求4-站点视觉升级与内容合规/STATE.md)
2. [`foundation/README.md`](./需求4-站点视觉升级与内容合规/foundation/README.md)
3. [`requirements/SPEC.md`](./需求4-站点视觉升级与内容合规/requirements/SPEC.md)
4. [`requirements/COPY.md`](./需求4-站点视觉升级与内容合规/requirements/COPY.md)
5. [`models/README.md`](./需求4-站点视觉升级与内容合规/models/README.md)
6. [`.design/README.md`](./需求4-站点视觉升级与内容合规/.design/README.md)
7. [`planning/PLAN.md`](./需求4-站点视觉升级与内容合规/planning/PLAN.md)
8. [`planning/DATA-MIGRATION.md`](./需求4-站点视觉升级与内容合规/planning/DATA-MIGRATION.md)
9. [`implementation/TASKS.md`](./需求4-站点视觉升级与内容合规/implementation/TASKS.md)
10. [`review/REVIEW.md`](./需求4-站点视觉升级与内容合规/review/REVIEW.md)

`TASKS.md` 是唯一勾选权威；`STATE.md` 记录当前事实；dated notes、旧 Review、截图、聊天摘要、历史 commit 和自动化测试只能说明当时状态。

## 当前阶段

需求4于 2026-08-19 完成第二轮预实施 Review。应用代码、文案迁移、测试重构、视觉改版、人工删除工具和生产环境尚未实施。

正确顺序：

```text
A 公共组件、上传与长任务进度
  → B 测试减负与领养排序
  → C 轻量内容/隐私、单条删除与第三方声明
  → D Hero 管理、灵动动效与首页四幕
  → E 独立 Review、用户验收与发布
```

不得从旧版“先建设复杂隐私 Schema”或“公开 UI 变更必须跑完整历史 E2E”的顺序继续执行。

## 执行纪律

- 默认使用任务分支与 PR；只有用户对当前操作明确授权直接 main 时才例外。
- 写前 fetch，核对 main SHA；不 force push、不 hard reset、不覆盖用户改动。
- 契约变化先同步需求4 foundation/SPEC/COPY/models/design/PLAN/DATA-MIGRATION/TASKS/STATE/CLAUDE。
- 不重写已执行历史迁移，只新增必要前向迁移。
- 不记录 Secret、token、签名 URL、PII、真实私有图片、QQ 聊天或完整 Object Key。
- 数据/媒体删除默认 dry-run、脱敏计数、强确认、精确对象、验证和幂等重入。
- 人工清理是“人判断 + 工具执行”，不是手工 SQL/控制台漏删。
- 测试先判断稳定不变量；不为全绿机械更新旧文案、DOM 或动画时长断言。
- 需求1的 Host、私有媒体、OSS/ESA、发布、恢复、备份和部署纪律继续生效。
- OSS Bucket CORS 保持当前 `AllowedOrigin=*`；匿名 API 仍需应用层 Origin/token/TTL/限流/蜜罐。
- 实现、focused review、独立 Review、用户验收和生产发布互不代签。
