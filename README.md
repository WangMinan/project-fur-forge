<p align="center">
  <img src="public/brand/apple-touch-icon.png" width="112" alt="有点小狗 DITE DOG">
</p>

<h1 align="center">有点小狗 · DITE DOG</h1>

<p align="center">让角色与摄影成为主角的兽装工作室网站。</p>
<p align="center"><a href="https://ditedog.com">访问公开站</a> · <a href="docs/DEPLOYMENT.md">部署文档</a> · <a href="agent_docs/README.md">需求与实现记录</a></p>

`project-fur-forge` 为有点小狗工作室提供作品展示、领养展示与委托申请，并配套一套用于日常内容维护的管理后台。公开站以图片为主，兼顾桌面和手机浏览；管理端负责从内容编辑到图片发布的完整流程。

## 可以做什么

| 公开站 | 管理后台 |
| --- | --- |
| 首页大图、代表作品与当前领养展示 | 独立维护首页／委托页的横版与竖版大图 |
| 作品目录、详情图库、缩略图与触控切换 | 作品信息、画师署名、价格、领养状态与排序 |
| 领养角色详情、画师署名与人民币价格 | 图片上传、用途构图、发布检查与下架 |
| 委托申请、图片附件与提交回执 | 申请筛选、处理结果、内部邮件通知与删除确认 |
| 中英切换、服务说明与联系方式 | 站点文案、营业状态、联系方式与访问概览 |

公开内容支持服务端渲染。图片按展示用途提供不同尺寸，图库支持键盘、触控和减少动态效果偏好。领养价格只在详情页展示，画师署名在领养目录与详情展示。

## 内容与图片如何协作

文字维护和媒体发布分别处理：已发布作品的基础信息与图片说明、已启用大图的替代文字，可以保存后直接公开生效；换图、移除图片、焦点和裁剪等媒体资产变更仍需先下架，再重新发布。

原图存放在私有 OSS Bucket。公开站只使用生成并校验完成的派生图片，由 ESA 分发；管理预览通过认证后的同源接口获取。公开像素变化生成新的不可变资源，下架同时处理页面撤销和媒体缓存清除。版本校验防止过期编辑覆盖更新。

## 技术栈

| 层次 | 实现 |
| --- | --- |
| 页面与交互 | Nuxt 4、Vue 3、TypeScript；公开站 SSR，管理页面 CSR |
| 服务端 | Nitro / H3、Zod 请求与响应校验 |
| 数据 | SQLite、better-sqlite3、Drizzle ORM 与前向 SQL 迁移 |
| 图片 | 阿里云 OSS、ESA、FFmpeg、Cropper.js |
| 通知与文档 | Nodemailer、pdf-lib |
| 质量检查 | ESLint、vue-tsc、Vitest、Playwright |
| 运行与交付 | Node.js 24、pnpm 11、Docker Compose、Nginx、GitHub Actions |

生产应用运行在冻结的 Docker 镜像中，以镜像摘要确定版本。Compose 管理应用和一次性运维容器，SQLite 使用持久卷；Nginx 反向代理应用，HTTPS 在 ESA 边缘终止。具体配置、备份与恢复见[部署文档](docs/DEPLOYMENT.md)。

## 本地开发

需要 **Node.js 24** 和 **pnpm 11.18.x**；具体版本约束见 [package.json](package.json)。Windows 使用 PowerShell 7。

```sh
pnpm install --frozen-lockfile
```

将 [.env.example](.env.example) 复制为 `.env`，填写开发环境的站点地址、数据库路径、会话密钥及媒体配置，再运行：

```sh
pnpm db:migrate
pnpm auth:init
pnpm dev
```

公开站、管理端和媒体使用独立 Host。完整上传与发布需要可用的 OSS／ESA 配置，开发时使用独立测试资源；浏览器测试使用隔离数据库和模拟媒体存储，不需要生产凭据。

## 验证

```sh
pnpm check:fast     # lint、类型检查与 core 测试
pnpm test:smoke     # 真实浏览器中的主要交互
pnpm build         # 生产构建与公开内容检查
```

镜像发布使用单独的 release 流程；测试通过、镜像发布和生产部署分别记录。自动检查不替代真实手机体验与视觉验收。

## 仓库导览

- [`app/`](app/)：公开站、后台页面、组件与交互。
- [`server/`](server/)：API、数据库、业务服务与媒体任务。
- [`shared/`](shared/)：前后端共用的数据契约和校验。
- [`tests/`](tests/)：核心逻辑、集成与浏览器回归。
- [`deploy/`](deploy/) / [`scripts/`](scripts/)：环境配置、交付与运维工具。
- [`agent_docs/`](agent_docs/)：需求规格、实施状态与验证证据；各项进度以对应记录为准。

本文件介绍项目及其实现。编码代理的工作约定在 [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)。品牌、作品图片与第三方组件的使用权分别归属其权利人；第三方依赖说明见 [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt)。

## 使用许可

本项目采用 [有点小狗个人学习源码可见许可](LICENSE)，允许个人非商业学习、私下修改及本人独用测试；未经书面许可，不允许传播修改版、向第三方提供部署服务或用于商业及组织业务。这是限制性源码可见许可，不是 OSI 开源许可证。

品牌、角色设计和图片不纳入代码复用授权；随附品牌图仅供许可范围内个人学习测试所需的本地显示。第三方依赖、字体等继续适用各自授权，见 [第三方声明](public/THIRD_PARTY_NOTICES.txt)。

原始素材、参考图、验收媒体与具体生产操作记录已转为私有归档。公开需求与通用部署文档保留；验证截图应写入被 Git 忽略的 `test-results/`。历史源码链接和 SHA 可能因仓库清理而失效，不能作为当前部署身份。
