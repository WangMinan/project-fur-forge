# 兽装工作室官网与管理端技术方案

> **资料边界**：这是 2026-07-28 外部讨论形成的技术方案输入，不是本仓库的实施契约。当前有效范围、页面、数据、OSS 安全边界、URL、媒体发布和运维策略一律以 [`requirements/SPEC.md`](../../requirements/SPEC.md)、[`planning/PLAN.md`](../../planning/PLAN.md)、[`implementation/TASKS.md`](../../implementation/TASKS.md) 与 [`STATE.md`](../../STATE.md) 为准；生产设计细化见 [`.design/README.md`](../../.design/README.md)。本文中的联系表单、公告、Nuxt UI、旧边缘方案或其他未被正式文档接纳的建议不得直接进入 TASKS/实现。

## 1. 结论

采用单仓库、单 Nuxt 4 应用、单 Docker 镜像、单 Node.js 进程：

- 公开官网：Nuxt SSR，后续按测量结果为低变更页面增加短时 SWR。
- 管理端：`/admin/**` 客户端渲染，使用独立布局和 Nuxt UI。
- 服务端：Nuxt Nitro Server API，承担鉴权、CRUD、发布、OSS 签名和联系表单。
- 数据库：SQLite + Drizzle ORM + `better-sqlite3`，数据库文件挂载到持久卷。
- 媒体：阿里云 OSS，自第一天启用；浏览器通过短期预签名 URL 直传，公开访问通过独立媒体域名。
- 部署：开发机完成 Docker 多阶段构建，生产机只拉取/加载镜像并运行，不在生产机安装依赖或构建 Nuxt。

当前阶段不引入 Spring Boot、Go 独立 API、PostgreSQL、Redis、消息队列或微服务。未来业务复杂度上升时，可在不重写 Nuxt 前端的前提下抽离 Nitro API。

## 2. 系统架构

```text
浏览器
├─ 公开页面 ───────────────> Nuxt SSR ───────> SQLite
├─ /admin 管理端 ──────────> Nitro API ──────> SQLite
└─ 图片直传 ───────────────> OSS 上传域名
                                      │
公开页面 <──── 边缘媒体域名 <──── OSS 私有源站

反向代理（Nginx/Caddy）
└─ HTTPS、Host、X-Forwarded-*、静态缓存头、请求限流

Docker
└─ 单 Nuxt Node 容器
   ├─ 只读应用文件
   ├─ /app/data 持久卷（SQLite）
   └─ /tmp 临时文件系统
```

## 3. 渲染策略

管理后台发布后需要立即生效，因此不应把数据库驱动的作品页全部做成构建期 SSG，否则每次修改都要重新构建镜像。

| 路径 | 初始策略 | 说明 |
|---|---|---|
| `/` | SSR | 首页精选作品和接单状态来自数据库 |
| `/works` | SSR | 作品筛选和分页 |
| `/works/[slug]` | SSR | 独立详情页，保证 SEO 和分享预览 |
| `/commission`、`/about` | SSR | 内容由后台编辑时采用 SSR |
| `/privacy`、`/terms` | Prerender | 仅在代码中维护时静态生成 |
| `/admin/**` | CSR，`ssr: false` | 无 SEO 需求，减少服务端渲染复杂度 |
| `/preview/**` | SSR/CSR，noindex | 登录后预览草稿 |
| `/api/admin/**` | 不缓存 | 所有写操作必须实时 |

第一版以正确性为先，不给公开 HTML 加页面缓存。上线后若服务器压力确实出现，再为首页、列表和详情增加 60～300 秒 SWR，并在发布操作后做缓存失效。

## 4. 推荐技术栈

### 核心

- Nuxt 4、Vue 3、TypeScript 严格模式、pnpm。
- Node.js 24 LTS，生产镜像采用 Debian slim。
- Nitro Node Server preset。
- Zod：前后端共享请求、表单和内容结构校验。

### UI

- 公开端：Tailwind CSS 为主，按品牌定制组件；只复用 Nuxt UI 的少量无障碍基础组件。
- 管理端：Nuxt UI Dashboard、Form、Table、FileUpload、Modal、Toast、Editor。
- 动效：CSS Transition + Motion for Vue；不在第一版引入 GSAP。
- 图片：`@nuxt/image` 的 Aliyun provider。

### 服务端与存储

- Nitro Server API。
- Drizzle ORM + `better-sqlite3`。
- `nuxt-auth-utils`：密封 HttpOnly Cookie Session、scrypt 密码哈希。
- `nuxt-security`：安全响应头、CSP、限流、CSRF/Origin 校验。
- `ali-oss`：生成 V4 预签名 PUT URL、HEAD 校验和对象操作。

### SEO

- `@nuxtjs/sitemap`：动态读取已发布作品及图片。
- `@nuxtjs/robots`：屏蔽 admin、preview、非生产环境。
- `nuxt-schema-org`：Organization、BreadcrumbList、ImageObject/CreativeWork。
- 页面级 `useSeoMeta` 和 canonical。
- 第一版直接使用作品封面作为 Open Graph 图片；不在小服务器上运行浏览器截图型 OG 渲染。

## 5. UI 设计方向

### 5.1 公开端：编辑型摄影作品集

视觉目标是“工作室品牌画册”，不是 SaaS 落地页，也不是组件库示例。

- 基底：暖灰白或近黑，正文高对比。
- 强调色：只保留一个主品牌色和一个少量使用的辅助色。
- 构图：12 栏桌面栅格、4 栏移动栅格；允许非对称，但必须保持清晰阅读顺序。
- 图片：真实兽装摄影占视觉面积的 60%～75%；使用固定比例避免布局跳动。
- 字体：中文使用本地系统字体栈；品牌拉丁字体自托管；不依赖中国大陆访问不稳定的远程字体服务。
- 圆角：卡片 10～18 px，按钮可用胶囊形；禁止所有容器都做大圆角。
- 页面：大标题、少量说明、明确 CTA、作品摄影，不堆砌功能卡片。

避免以下常见 AI 前端风格：

- 紫蓝渐变铺满整站；
- 大量毛玻璃、光晕和无业务意义的 3D 球体；
- 每个区块都是同尺寸圆角卡片；
- 所有按钮都是巨型胶囊；
- 为动画而动画、滚动劫持和长时间开场 Loader；
- 使用占位图完成最终视觉评审。

### 5.2 动效规则

- 首屏入场 600～900 ms，普通区块 250～450 ms。
- 主要动画只使用 `transform` 和 `opacity`。
- 图片 Hover 最大缩放约 1.02，并显示角色名或制作类型。
- 页面切换采用轻微淡入与位移，不做全屏遮罩式长转场。
- 同屏最多一个主要运动焦点。
- 全站尊重 `prefers-reduced-motion`；关闭视差、自动播放和大幅位移。

### 5.3 管理端：安静、明确、可校验

- 240 px 左侧导航，顶部放保存、发布、预览。
- 桌面端作品编辑页采用“左侧表单 + 右侧实时预览”。
- 状态采用草稿、已发布、已归档三态。
- 图片支持拖拽排序、封面标记、Alt 文本、上传进度和失败重试。
- 发布前显示完整性检查：封面、摘要、分类、至少一张图片、Alt、SEO 标题和摘要。
- 管理端不使用装饰性大动画；仅保留 Toast、抽屉和拖拽的必要反馈。

### 5.4 初始设计 Token（均为占位，应由工作室 Logo 和代表作重新取色）

```css
:root {
  --public-bg: #f4f2ed;
  --public-ink: #111318;
  --public-muted: #686d76;
  --public-border: #d7d5cf;
  --brand-primary: #4f65ff;
  --brand-accent: #c9ff5a;
  --radius-card: 14px;
  --radius-control: 10px;
  --content-max: 1440px;
}
```

## 6. 页面与管理功能

### 公开端

- 首页：品牌首屏、接单状态、精选作品、系列简介、委托 CTA。
- 作品列表：系列、类型、物种标签筛选；分页优先于无限滚动。
- 作品详情：标题、角色/系列信息、完成时间、说明、图片画廊、前后作品。
- 委托说明：流程、范围、工期口径、尺寸要求、售后和 FAQ。
- 动态与公告：接单开放、展会活动和重要通知。
- 关于我们：工作室简介、成员、制作理念、联系和社交平台。
- 联系：公开渠道；可选轻量联系表单。

### 管理端

- 登录。
- 仪表盘：草稿数、最近发布、未读联系消息、媒体异常。
- 作品管理：列表、编辑、预览、发布、归档。
- 媒体资源：上传、检索、未引用资源、软删除。
- 首页内容。
- 委托说明与 FAQ。
- 动态公告。
- 站点设置：Logo、联系渠道、SEO 默认值、接单状态。
- 联系消息：只读/标记已处理。

## 7. 数据模型

避免建立万能 EAV CMS。核心实体使用明确字段，少量页面结构使用经过 Zod 校验的 JSON。

### `users`

- `id`
- `username`
- `password_hash`
- `role`
- `session_version`
- `disabled_at`
- `created_at`、`updated_at`

### `works`

- `id`（UUID）
- `slug`（唯一、发布后尽量稳定）
- `title`
- `species`
- `suit_type`（fullsuit / partial / head 等）
- `series_id`
- `status`（draft / published / archived）
- `summary`
- `body_markdown`
- `cover_asset_id`
- `featured_rank`
- `completed_at`
- `published_at`
- `seo_title`
- `seo_description`
- `created_at`、`updated_at`

### `assets`

- `id`
- `object_key`
- `original_name`
- `mime_type`
- `byte_size`
- `width`、`height`
- `alt_text`
- `status`（pending / ready / deleted）
- `created_at`、`deleted_at`

### `work_assets`

- `work_id`
- `asset_id`
- `role`（cover / gallery / detail）
- `sort_order`
- `caption`

### 其他

- `series`
- `tags`、`work_tags`
- `content_pages`
- `announcements`
- `site_settings`
- `contact_messages`
- `slug_redirects`
- `audit_logs`

正文统一保存受限 Markdown，不允许管理员输入任意 HTML。渲染时服务端按白名单转换并清洗。

## 8. OSS 方案

### 8.1 域名和权限

- 私有原图与网页衍生 Bucket 上线时都使用 private + Block Public Access。
- 管理员预签名 PUT/HEAD 直连私有原图 Bucket 的公网 OSS 域名，不增加上传专用 CNAME。
- `public-media.ditedog.com` 由 ESA 同账号私有回源网页衍生 Bucket；阿里云自动完成回源 STS 鉴权，业务应用不处理 STS。
- 客户端 HTTPS 由 ESA 边缘证书终止；首版公开媒体不做自定义边缘 URL 鉴权。
- OSS CORS 只允许正式站点和必要的开发 Origin，开放 `PUT`、`GET`、`HEAD`，暴露 `ETag`。
- OSS AccessKey 仅存在服务端运行环境；首版沿用独立静态 AK/SK，不引入 ECS RAM 角色。

### 8.2 上传流程

1. 管理员选择图片，浏览器读取 MIME、大小、宽高并生成本地预览。
2. `POST /api/admin/assets/presign`，提交元数据。
3. 服务端验证登录、类型、大小，生成不可预测且不可复用的 object key，例如：
   `works/{workId}/{assetUuid}.{ext}`。
4. 服务端生成有效期约 5 分钟的 V4 预签名 PUT URL。
5. 浏览器直接 PUT 到 OSS，并显示进度；图片流量不经过 Nuxt 容器。
6. `POST /api/admin/assets/complete`。
7. 服务端通过 HEAD 和 OSS 图片信息确认对象存在、大小匹配、图片可解析，再把资源状态改为 ready。
8. 发布页面只引用 ready 状态资源。

预签名 URL 在有效期内可被重复使用并覆盖同一 object key，因此 object key 必须使用 UUID，不能直接使用用户文件名。

### 8.3 图片规则

- 网站主图上传上限设为 20 MB，以适配 OSS IMG 默认源图限制。
- 需要保留更大原片时，放入单独的私有归档 Bucket，不直接用于网站。
- 标准输出宽度：320、480、640、960、1280、1600、1920。
- 第一版使用 WebP + JPEG/PNG fallback；AVIF 作为后续可选项。
- 首屏图不懒加载，并明确宽高；首屏以下图片懒加载。
- OSS 负责缩放、裁切和格式转换，Nuxt 服务器不运行 Sharp 处理远程作品图片。

### 8.4 删除与恢复

- 数据库先软删除，7～30 天后异步/定时物理删除 OSS 对象。
- OSS 开启版本控制，防止误覆盖和误删除。
- 生命周期规则清理旧版本和未完成的分片上传。

## 9. 鉴权与安全

- 不开放注册，只由初始化脚本创建管理员。
- 密码用 scrypt 哈希。
- Session 使用加密、HttpOnly、Secure、SameSite Cookie；不把长期 Token 存在 localStorage。
- Session 中只保存用户 ID、角色和 `session_version`；每次管理 API 调用进行服务端权限校验。
- 前端路由中间件只用于界面跳转，不能代替服务端授权。
- 登录、联系表单和预签名接口分别限流。
- 所有写请求校验 `Origin`/CSRF Token。
- CSP 仅允许本站脚本、公开媒体域名和上传连接域名。
- Nitro API 请求体限制在较小范围，图片不经过 API。
- 日志中不得打印密码、Session、AccessKey、预签名 URL 或完整联系信息。

## 10. SQLite 运行约束

- 单应用实例、单本地持久卷，不把 SQLite 文件放在 NFS。
- 启用：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = FULL;
```

- 该架构允许多个读取者和一个写入者，适合少量管理员和以读取为主的官网。
- 不进行水平扩容；出现多实例、复杂报表或高写入需求时迁移到 PostgreSQL。
- 使用较新的 SQLite 运行库，并在依赖更新中覆盖 WAL 相关安全修复。

## 11. 项目结构

```text
app/
├─ assets/css/
├─ components/
│  ├─ public/
│  ├─ admin/
│  └─ shared/
├─ layouts/
│  ├─ default.vue
│  └─ admin.vue
├─ middleware/admin.ts
└─ pages/
   ├─ index.vue
   ├─ works/
   ├─ commission.vue
   ├─ announcements/
   ├─ about.vue
   └─ admin/

server/
├─ api/
│  ├─ public/
│  ├─ admin/
│  └─ auth/
├─ middleware/
├─ plugins/
└─ utils/
   ├─ auth.ts
   ├─ db.ts
   ├─ oss.ts
   ├─ markdown.ts
   └─ validation.ts

shared/
├─ schemas/
├─ types/
└─ constants/

db/
├─ schema.ts
└─ seed.ts

drizzle/
scripts/
tests/
```

公开端和管理端组件禁止相互引用大型页面组件；依赖按路由切分，避免后台编辑器进入公开首页 Bundle。

## 12. 关键 API

### 公开

- `GET /api/public/site`
- `GET /api/public/works`
- `GET /api/public/works/:slug`
- `GET /api/public/announcements`
- `POST /api/public/contact`

### 鉴权

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/_auth/session`（由 auth-utils 提供）

### 管理

- `GET/POST /api/admin/works`
- `GET/PATCH/DELETE /api/admin/works/:id`
- `POST /api/admin/works/:id/publish`
- `POST /api/admin/works/:id/archive`
- `POST /api/admin/assets/presign`
- `POST /api/admin/assets/complete`
- `DELETE /api/admin/assets/:id`
- `GET/PATCH /api/admin/pages/:key`
- `GET/POST/PATCH /api/admin/announcements`
- `GET/PATCH /api/admin/settings`
- `GET/PATCH /api/admin/contact-messages`

## 13. 发布与预览

- 草稿、已发布、已归档三态。
- 预览使用已登录管理员或短时签名预览令牌。
- 发布前执行服务端完整性校验。
- 已发布 slug 修改时写入 `slug_redirects`，旧地址返回 301。
- 发布事务只修改数据库引用和状态，不复制或重编码图片。
- 第一版 SSR 立即显示新内容；增加 SWR 后，发布接口必须同步清理相应缓存。

## 14. Docker 与部署

### 14.1 原则

- 生产机不执行 `pnpm install`、`nuxt build` 或图片处理。
- 镜像只包含 `.output` 和运行所需迁移资源。
- SQLite 文件不写入镜像，挂载到 `/app/data`。
- OSS 密钥、Session 密钥和站点配置通过运行时环境变量注入。
- 镜像使用 Git SHA 或版本号，不只使用 `latest`。
- 应用以非 root 用户运行，根文件系统只读，仅 `/app/data` 和 `/tmp` 可写。

### 14.2 Dockerfile 骨架

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm test
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000
WORKDIR /app
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app app \
 && mkdir -p /app/data /tmp \
 && chown -R app:app /app /tmp
COPY --from=build --chown=app:app /app/.output ./.output
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

迁移程序应在构建阶段编译并随镜像发布，部署时以一次性步骤运行；不要在多副本并发执行迁移。若开发机和服务器 CPU 架构不同，使用 `docker buildx build --platform linux/amd64` 等明确目标架构。Debian slim 比 Alpine 更适合降低 `better-sqlite3` 等原生依赖的 musl 兼容风险。

### 14.3 Compose 运行约束

```yaml
services:
  studio:
    image: registry.example.com/fursuit-studio:${IMAGE_TAG}
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - studio_data:/app/data
    read_only: true
    tmpfs:
      - /tmp
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL

volumes:
  studio_data:
```

反向代理负责 HTTPS。首次容量测试可从 512 MiB 容器上限开始，测量空闲 RSS、发布操作、并发 SSR 和登录请求后再调整；不要把 256 MiB 作为未经测试的稳定目标。

### 14.4 部署顺序

1. 开发机执行 lint、typecheck、unit、E2E。
2. 构建带 Git SHA 的镜像。
3. 推送镜像仓库或通过 `docker save/load` 传输。
4. 对 SQLite 做一致性备份。
5. 运行一次数据库迁移。
6. 启动新容器。
7. 检查 liveness、readiness、首页和管理端登录。
8. 保留上一镜像用于快速回滚。

数据库迁移尽量采用向后兼容的 expand/contract 方式，否则镜像回滚不等于数据库回滚。

## 15. 备份与可观测性

- 每日使用 SQLite Backup API 或 `VACUUM INTO` 生成一致性备份。
- 备份上传到独立私有 OSS Bucket；保留 7 份日备、4 份周备和若干月备。
- 每次迁移前强制备份。
- 定期执行恢复演练，而不是只确认备份文件存在。
- 日志输出 stdout，包含 request id、路由、状态码、耗时，不记录敏感内容。
- 健康检查：
  - `/api/health/live`：进程存活。
  - `/api/health/ready`：数据库可读且迁移版本正确。
- 重点监控 RSS、事件循环延迟、接口 P95、登录失败率、OSS 上传失败率和 5xx。

## 16. 测试与验收

### 自动化测试

- Vitest：数据校验、权限判断、slug、Markdown 清洗、OSS object key。
- Nuxt 测试工具：Server API 和数据库集成测试。
- Playwright：登录、建草稿、上传图片、排序、发布、公开访问、归档、旧 slug 301。
- Playwright 视觉测试：390×844、768×1024、1440×900。

### UI 验收

- 首屏在关闭 JavaScript时仍有基本标题、简介和可抓取链接。
- 图片全部有固定宽高和 Alt，不出现明显布局跳动。
- 键盘能够完成导航、登录、表单和发布。
- 移动端无横向滚动、标题不溢出、CTA 可触达。
- `prefers-reduced-motion` 下无视差和大幅位移动画。
- 公开页面不加载管理端编辑器和表格代码。

### 业务验收

- 管理员无需重新构建镜像即可发布或撤下作品。
- 上传图片流量不经过应用容器。
- 容器重建后数据库和媒体引用不丢失。
- 误删作品和图片存在可验证的恢复路径。
- 每个已发布作品都有唯一 URL、完整 SEO 元数据和图片 Sitemap 条目。

## 17. 实施阶段

### 阶段 0：设计与契约冻结

- 确定 Logo、品牌主色、字体和真实摄影素材。
- 确定公开页面信息架构。
- 冻结 `works`、`assets`、`content_pages` 等数据结构。
- 完成首页、作品详情、管理端编辑页三张关键原型。

### 阶段 1：工程底座

- Nuxt、Nuxt UI、数据库、迁移、鉴权、安全头。
- Docker 多阶段构建和开发/生产配置。
- 健康检查与初始化管理员。

### 阶段 2：OSS 与作品后台

- 预签名直传、上传进度、完成校验、媒体库。
- 作品 CRUD、排序、草稿、预览、发布和归档。

### 阶段 3：公开官网

- 首页、作品列表、详情、委托说明、公告和关于页面。
- Nuxt Image、响应式画廊、克制动效和移动端适配。

### 阶段 4：SEO 与上线加固

- Sitemap、robots、canonical、结构化数据、分享卡片。
- E2E、视觉回归、备份恢复、限流和安全检查。
- 容量测试后再决定是否启用 SWR 和具体内存上限。

## 18. 明确不做

第一版明确不做以下内容：

- 独立 Spring Boot 或 Go 后端。
- 微服务、Redis、消息队列。
- 在线支付、订单结算、复杂排期和合同流转。
- 让 Nuxt Studio/Git 提交承担核心运行时后台。
- 服务端转发作品原图或运行重型图片转码。
- 公开端全站套用后台组件库默认样式。
- 大量 WebGL、滚动劫持和全屏视频自动播放。

## 19. 演进条件

出现以下任一条件时，评估迁移 PostgreSQL或抽离 API：

- 需要运行多个应用副本；
- 管理员并发写入明显增多；
- 出现客户、报价、合同、支付、排期等强事务流程；
- 需要复杂审计、报表或异步任务；
- 第三方客户端需要长期稳定的公开 API。

在此之前，单 Nuxt 全栈应用是工程量、资源占用、维护成本和视觉表达之间更合适的平衡点。
