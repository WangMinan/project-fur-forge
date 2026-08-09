# 状态

> **角色**：当前需求的状态机与执行入口。历史过程见 `implementation/notes/`。
> **最后更新**：2026-08-09。
> **当前代码基线**：`903b213775c403df358507d994bb31ef7c79bd11`（更新文档前的 `main` / `origin/main` 同一 SHA）。

## 当前阶段

阶段 C/C.1 已完成并于 2026-08-07 通过用户验收。阶段 D 的返图、轻量展会掉落、两轮修复已经合入并推送；用户于 2026-08-09 明确以人工 Review 关闭 T42，逐任务独立 Review 合并到 T49。

项目现在进入：

> **阶段 E · 最小访问统计与发布级工程收口。当前下一项：T46。**

阶段 E 完成后进入阶段 F，处理备案、品牌、两只现有 OSS Bucket 私有化、CDN URL 鉴权、正式环境和真实使用验收。

阶段 D 用户门禁见 [`implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md`](./implementation/notes/stage-d/T42-USER-ACCEPTANCE-2026-08-09.md)。阶段 E/F 决策见 [`implementation/notes/stage-e/STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md`](./implementation/notes/stage-e/STAGE-E-PRODUCTION-DECISIONS-2026-08-09.md)。

## 已完成产品基线

- 作品、常规领养、首页、委托、关于、政策页和官方渠道；
- 私有原图与网页衍生物分离、预生成 SourceSet、作品水印、站点/返图无水印；
- 唯一管理员、Host/Origin/CSRF、版本冲突、限流与安全日志；
- publication/watermark/reconcile/return operation 的 lease、heartbeat、恢复与精确清理；
- 返图“设定 + 多张返图”、随机 `/returns` 与设定页；
- 轻量展会掉落、公开倒序、首页精选顺序与固定 10 秒轮播；
- 备份/验证恢复、Node 24 镜像、Compose/Nginx 和 CI 骨架。

以上是产品与工程基线，不代表正式环境已经上线。

## 阶段 E 已锁定范围

只实施：

1. **T46**：最小化第一方访问统计；
2. **T49**：修复发布级 CI，并在新上下文综合 Review 阶段 D/E；
3. **T50**：全站最终 E2E 与浏览器回归。

已取消或转交：

- T43 邮件找回密码取消，继续离线重置；
- T44 CSV 导出取消；
- T45 原图档案 UI 取消；
- T47 高级媒体/批量运维 UI 取消，低频操作进入 Handbook；
- T48 已完成调研与范围确认，实际 CDN/生产隔离实现转交 T52-F1～F5。

## 阶段 F 已锁定生产事实

### 品牌与备案

- ICP 备案审批中，备案网站名称为“有点小狗”；
- 公开桌面导航、移动导航和复用公开壳的登录页，中文导航品牌必须精确为“有点小狗”，不能带“工作室”；
- 该决定不自动改写作品主人显示、工作室介绍、服务条款或版权文字；
- 中国内地 CDN 正式接入等待备案结果与平台同步完成。

### OSS 与 CDN

- 继续使用当前两只杭州 Bucket，不新建生产 Bucket；
- 用户允许直接修改 ACL，开发站暂时失效可以接受；不保留旧匿名 OSS URL 兼容；
- 两只 Bucket 都改为 private 并开启 Bucket 级 Block Public Access；
- 私有 Bucket 保存原图/处理源，衍生 Bucket 只保存网页衍生物；
- CDN 只对衍生 Bucket 使用同账号私有回源；其全 Bucket 读取能力由严格存储职责隔离约束；
- 公开页只下发约 24 小时（`86400` 秒）有效的 CDN URL 鉴权地址；
- 下架立即撤销页面投影，并对精确 CDN URL 提交 `Force=true` 强制刷新；用户接受服务器侧通常约 5～6 分钟完成撤销；
- 分享、永久公开 URL、海报和二维码后置。

### Endpoint 与凭据

- 杭州生产 ECS 服务端：`https://oss-cn-hangzhou-internal.aliyuncs.com`；
- 本地服务端：杭州公网 Endpoint；
- 管理浏览器上传：私有 Bucket 杭州公网域名，绝不能出现 `-internal`；
- 公开图片：CDN 媒体域名，绝不能出现 OSS Bucket 域名；
- `.env` 生产实例、`.env.example`、`.env.compose.example`、runtime 示例/校验、部署说明与 preflight 同步；
- 保持当前应用 AK/SK 方案，不引入新的凭据体系。

完整执行清单见 [`implementation/PRODUCTION-LAUNCH-HANDBOOK.md`](./implementation/PRODUCTION-LAUNCH-HANDBOOK.md)，官方调研见 [`planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md`](./planning/ALIYUN-PRODUCTION-RESEARCH-2026-08-09.md)。

## 当前任务状态

| 任务 | 状态 | 下一步 |
| --- | --- | --- |
| T42 | **用户门禁已关闭** | 独立 Review 移交 T49 |
| T43/T44/T45/T47 | **范围关闭，未实施** | 不建设对应功能 |
| T46 | **待实施** | 后端统计契约与前向迁移 |
| T48 | **调研/契约完成** | 实现转 T52-F1～F5 |
| T49 | **待 T46** | 同一 SHA CI + 新上下文综合 Review |
| T50 | **待 T49** | 全站三视口与恢复回归 |
| T51 | **等待备案/正式素材** | 导航品牌、ICP 与视觉校准 |
| T52 | **范围已展开，待实施** | F1 配置拆分开始 |
| T53 | **等待 T51/T52** | 正式环境真实使用验收 |

## 当前阻断与开放输入

不阻断 T46/T49/T50 的外部输入：

- ICP 审批结果、备案号与平台同步时间；
- 正式公开、管理、媒体三个域名；
- URL 鉴权主/备 Key（上线时创建，只保存为 Secret）；
- 用户可接受的月度预算，以及目标环境实测后确定的 CDN 用量封顶数值；
- 用户确认 EXT-01 已登记素材是否可直接作为正式上线素材；若否，提供需要替换的 Logo、Hero、作品或返图。

这些值不得用占位符冒充完成。数值未确定前可以完成代码和受控测试，不能完成 T51/T52-F5/T53。

## GitHub Actions 已知边界

历史证据仍是：

- `image-build` 成功；
- `checks` 在 Production build 失败；
- `e2e` 因依赖失败跳过。

T49 必须基于届时最新 `main` 重新复现和验证。不得用当前本地通过、旧提交或不同 SHA 的结果宣称远端全绿。

## 下一步顺序

1. T46-B：访问统计迁移、数据最小化、API 和保留期；
2. T46-F/V：管理端统计、公开最佳努力采集、实现验证与隐私文案确认；独立 Review 统一在 T49；
3. T49：CI 同一 SHA 全绿 + 阶段 D/E 独立综合 Review；
4. T50：全站最终 E2E、浏览器、媒体和进程恢复回归；
5. T51：备案、导航“有点小狗”、正式素材与页脚；
6. T52-F1～F5：Endpoint、Bucket 私有化、CDN URL 鉴权/撤销、成本与监控；
7. T52-F6/F7：正式 Compose、TLS、空卷、备份/恢复/回滚和 Handbook 演练；
8. T53：用户真实使用验收与文档闭环。

## 当前发布边界

- 当前未取得正式上线结论；
- 未经授权不创建 `v*` tag、不触发 Docker Hub 正式发布、不远程部署；
- 备案未完成前不把中国内地 CDN 域名接入描述为完成；
- 不以把 Bucket 改回 public-read 作为回滚方案；
- 只有 T49、T50、T51、T52、T53 全部关闭后，才可声明“正式上线就绪”。
