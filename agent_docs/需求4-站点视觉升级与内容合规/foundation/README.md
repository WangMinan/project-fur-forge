# 阶段 0 · 地基（Foundation）

> **角色**：固定需求4的模块边界、继承关系、数据/安全口径与不可扩散的非目标。
> **状态**：2026-08-19 已锁定。任何偏离必须先同步本文件、SPEC、PLAN、TASKS 和 STATE。
> **代码基线**：`main@913d257281e0b6a7ca60711cc62b78534904c6bd`。

## 1. 继承与覆盖

需求4是增量，不重建项目：

- 需求1继续提供双 Host、私有源图与公开派生、OSS/ESA、发布 operation、lease/recovery、认证、安全、部署与质量基线。
- 需求2仅保留仍未被覆盖的二维码媒体链与名称搜索实现经验。
- 需求3是当前业务模型基线：返图/动态已退役；官方渠道为邮箱、QQ、QQ群；作品/领养已简化；四个 Hero 集合、委托私密投递和后台处理继续存在。
- 需求4只覆盖公开视觉编排、动效系统、Hero 焦点配置、访客文案、委托告知/保留/删除、服务条款与第三方声明。
- 不恢复返图墙、最新动态、FAQ、五平台联系、旧作品字段或在线交易能力。

发生冲突时，需求4仅在本文和 SPEC 明确列出的条款上覆盖需求3，其余仍以需求1～3为准。

## 2. 模块边界

- `app/pages/index.vue`、`app/components/Home*`、`Featured*`、`CommissionLead.vue`：首页四幕与图片优先编排。
- `app/components/PublicHeader.vue`、`PublicFooter.vue`、公开行动组件与 `app/assets/css/public-base.css`：公开设计 token、导航、按钮、材料与动效语义。
- `app/pages/commission/apply.vue`：成年声明、隐私告知、非接单声明和版本过期反馈。
- `app/pages/about.vue`、`commission/index.vue`、`service.vue`、`privacy.vue`、`licenses.vue`：目标文案与法务/授权展示。
- `app/components/admin/HeroCollectionItemCard.vue` 及现有 Hero 管理 composable/API：未启用 Hero 的九宫格焦点选择与预览。
- `server/utils/recipe/site-display-recipe.ts`、`media-source.ts`：继续使用既有 `focal_x/focal_y` 参与 OSS gravity 与公开变体身份，不创建平行裁切系统。
- `shared/schemas/commission.ts`、委托 API/service/repository 与数据库迁移：申请确认版本、真实处理者元数据、删除边界。
- `scripts/` 与 `package.json`：人工保留复核/删除 CLI、第三方声明生成和校验命令。
- `agent_docs/需求4-站点视觉升级与内容合规/`：本增量唯一活文档集。

以下模块只继承、不在本轮重构：管理员认证、作品发布、水印模型、OSS CORS、Nginx/Compose、支付外部流程、QQ 平台本身。

## 3. 设计事实来源

设计参考只用于抽取原则，不复制品牌、素材、文案或完整布局：

- Apple 中国首页：一屏一重点、短标题、少量行动、大幅视觉主体。
- 渔屋首页：国内兽装工作室首页覆盖作品、估价和领养的完整业务地图。
- 万物通行兽装页：全屏 Hero、整幅主模块与不等面积模块的节奏关系。
- Apple Design Skill：即时响应、空间一致性、可中断直接操作、克制、材料层级、排版与无障碍。

Apple Design Skill 不是仓库依赖，不要求引入 Motion/Framer Motion，不要求为普通滚动揭示使用 spring。只有真正的连续拖拽/手势交互才考虑速度继承和可中断物理；本轮默认保留原生滚动和 CSS/WAAPI 渐进增强。

## 4. 接口口径

### 4.1 公开内容

- 首页继续只消费一个聚合投影；不得为了四幕拆成多组互相放大的公开请求。
- 现有 Hero、精选、委托入口、当前领养数据继续复用；第一件精选作品作为代表作品，剩余精选作为次级浏览。
- 空数据受控降级：无精选则隐藏作品幕；无可领养则隐藏领养幕；委托大图不可用时保留短文案与申请入口。
- 公开 DTO 不因视觉重构重新暴露内部 purpose、PII、Object Key、媒体状态或管理版本。

### 4.2 委托确认

建议新增只读元数据接口：

```text
GET /api/public/v1/commission-intake-meta
```

只返回当前隐私政策版本、申请告知版本、处理者公开名称、最低年龄与链接，不返回任意申请数据。

`POST /api/public/v1/commission-submissions` 在现有字段之外要求字面量确认和客户端看到的版本；版本过期返回稳定 409，访客重新阅读后再提交。上传会话仍沿用需求3 token/TTL/限流/Origin/蜜罐/一次消费边界。

### 4.3 删除能力

- 首版为受控 CLI/容器 operation，不提供匿名公开删除接口。
- 单条删除按 submission ID 或回执定位；批量候选只允许受限状态和截止时间。
- 默认 dry-run；正式执行要求显式 `--execute` 与固定强确认短语。
- 不建设自动调度、通用规则引擎或后台批量“一键清空”。

## 5. 数据库口径

- `assets.focal_x/focal_y`：现有归一化坐标继续作为站点展示裁切重心；不新增 Hero crop 表。
- `site_content`：新增或结构化保存个人信息处理者公开名称；隐私联系复用现有 `contact_email`。
- `commission_submissions`：以前向 expand 方式记录 intake contract version、成年确认、隐私政策版本、申请告知版本与确认时间。
- 历史申请不得伪造确认：旧行保留 legacy contract version，新增确认字段为 NULL。
- 不新增订单、合同、付款、退款、排期、保修工单或 QQ 聊天记录表。
- 不新增 `retention_until` 自动生命周期字段；已接单的业务结束时间由工作室在外部订单流程中判断。
- 第三方声明为构建产物/仓库文件，不进业务数据库。

## 6. 安全与隐私约定

- 真实手机号、QQ、身高、体重、私有设定图、经营主体证件、聊天记录不得进入 Git、测试 fixture、公开 DTO、HTML、URL、analytics、普通日志或错误响应。
- 委托设定图继续保持 PRIVATE、无 PUBLIC variant、无 ESA、无水印。
- 申请列表继续不铺开手机号、QQ、体型和图片；详情只在管理 Host 认证后按需读取，`no-store`。
- 删除盘点和执行证据只保留脱敏计数、时间、状态和不可逆标识摘要，不保留完整 Object Key 或原始内容。
- 用户提出查询、更正或删除时，以隐私政策公布的邮箱受理；符合继续保存条件时限制非必要处理并说明原因。
- 仅允许年满 18 周岁的申请人提交；不通过多收集身份证件来证明年龄。
- OSS CORS 继续为用户确认的 `AllowedOrigin=*`；需求4不得把 CORS 收紧重新设为门禁。

## 7. Git、测试与发布约定

- 当前 main 保护与 Actions 规则保持现状，不新增 required status check。
- 不新建独立重型 workflow；轻量声明校验可以复用现有 checks 或本地命令，但不得扩大 main 合并门禁。
- 默认任务分支和 PR；用户对某次直接 main 写入的授权不扩散。
- 文档/Schema/迁移/写操作串行，不重写历史迁移。
- UI 验证至少覆盖 `390×844`、`430×932`、`768×1024`、`1023×900`、`1024×900`、`1440×900` 和一台真实手机。
- 最终发布必须分别完成代码门禁、独立 Review、景宸/用户视觉验收、真实隐私主体配置和人工清理演练。

## 8. 编码与命名约定

- 动效 token 使用 `motion-*` 语义命名；不要在各组件继续散落 620ms、680ms 等局部常量。
- 纵向运动表示阅读进程；横向运动只表示同一媒体序列；缩放只表示按压、选择或共享对象连续性。
- 非手势动效优先 CSS transition/WAAPI；只有连续直接操作才使用 Pointer Events 和可中断 spring。
- 公开行动统一为 primary / secondary / text 三类，不继续复制多套胶囊按钮 CSS。
- 访客文案短、直接、陈述真实流程；避免反复以“本站不提供……”堆叠防御性语气。
- 破坏性 CLI 使用 `commission-retention` 或同等清楚名称；禁止模糊的 `cleanup-all`。
