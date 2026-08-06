# 状态

> **角色**：当前需求的状态机与执行入口。只记录现在有效的阶段、阻断项和下一步；历史过程见 `implementation/notes/`。
> **最后更新**：2026-08-07。
> **复核基线**：`aac745167e640e5ef20b4d054539a9a245ca109e`；本轮业务收口起点为 `10a18291edc62a13296859ac7a2102c744086907`。

## 当前阶段

项目仍处于 **阶段 C.1 · P0 收口修复**。

T34-F1 至 T34-F6 的实施工作已完成，本地完整非 Docker 门禁通过。当前结论：

> **PASS WITH REQUIRED CLOSURE（等待用户验收与远端全绿）**

`T34-F8` 与 `GATE-C1` **仍未通过**，也不进入 T35。剩余阻断只有两项：

1. GitHub Actions 三个 job 尚未在同一 SHA 全绿——最近几次 push 被
   `The job was not acquired by Runner of type hosted` 阻断，是自托管 runner 的
   基础设施问题，不是代码失败；
2. T34-F8 由用户执行公开端/管理端视觉验收与新上下文独立 Review。

本轮修改范围（业务代码）：

- 两个前向迁移 0020、0021（未改 0000–0019）；
- `server/utils` 按 repository/service/runner/recipe/route 分目录；
- `app/pages/index.vue` 首页顺序、官方渠道 Card 与首屏设置边界；
- readiness 严格迁移校验与诚实的 `/api/health`；
- 新增 reconcile 与双 Bucket 验证脚本；
- 对应单元、集成与 E2E 用例。

实施细节见
[`implementation/notes/t34-c1/T34-C1-CLOSURE-2026-08-07.md`](./implementation/notes/t34-c1/T34-C1-CLOSURE-2026-08-07.md)。

## 已确认且继续有效的产品决策

媒体公开规则仍以 [`requirements/MEDIA-PUBLICATION-POLICY.md`](./requirements/MEDIA-PUBLICATION-POLICY.md) 为唯一事实源：

- 首页与委托页横竖 Hero 使用无水印站点展示变体；
- 首页委托和领养入口使用各自独立的无水印变体；
- 作品列表、作品详情、领养列表和领养设定图继续使用活动水印；
- 永久原图、处理源和 Logo 候选始终私有。

首页入口与营业状态合并为统一业务入口卡；作品详情竖图使用限宽舞台；管理端文案使用分区 Card 和分区版本。

## 当前任务状态

| 任务 | 当前状态 | 剩余工作 |
| --- | --- | --- |
| T34-F1 | **完成** | reconcile 命令与容器子命令、既有 Hero/领养补齐、失败重试与旧投影保留、真实双 Bucket 9/9 通过 |
| T34-F2 | **完成** | 首页顺序与公开站 IA 统一，三视口视觉回归通过 |
| T34-F3 | **完成** | 邮箱、QQ、抖音与防诈骗提醒统一在 contact 分区 Card；首屏设置不再提供第二入口 |
| T34-F4 | **完成** | 四个仓储抽出，配方层 SQL 归零，`server/utils` 按五层分目录 |
| T34-F5 | **完成** | 迁移 0020 lease/heartbeat/attempt、启动恢复插件、真实子进程 SIGKILL 中断测试 |
| T34-F6 | **完成（业务侧）** | readiness 严格迁移校验完成；Compose 静态检查仍需远端流水线实际执行到 |
| T34-F7 | **等待远端 runner** | 业务门禁错误已修复，本地全绿；`quality` 三个 job 需在同一 SHA 成功，当前被自托管 runner 未接单阻断 |
| T34-F8 | **未开始** | 由用户执行最终视觉验收和新上下文独立 Review |
| GATE-C1 | **未通过** | 依赖 T34-F7 远端全绿与 T34-F8 用户确认 |

## 已确认的当前阻断项

### 1. 远端 CI runner

业务侧门禁错误已修复，本地 `APP_ENV=test` 下 lint、typecheck、unit、integration、
build、verify:production、secret scan 与 E2E 全部通过。

但 `quality` 仍未取得同一 SHA 的三 job 全绿：最近几次 push 的 `checks` 与
`image-build` 都以

```text
The job was not acquired by Runner of type hosted even after multiple attempts
```

结束，`e2e` 因 `needs: checks` 跳过。这是自托管 runner 未接单，**不是**代码
失败。需要用户确认 runner 可用后重跑，`docker compose config --quiet` 也要在
那次运行里真正执行到。

### 2. T34-F8 用户验收

公开端与管理端视觉验收、以及新上下文独立 Review 仍待用户执行。实施者不代签。

## 部署与 CI 当前约束

- Compose 文件统一命名为根目录 `docker-compose.yaml`；
- 本地仍禁止执行 `docker build`、`docker compose up`、空卷演练或本地 Nginx 验收；
- Dockerfile 已由 GitHub Actions 成功构建验证；
- 当前没有正式域名，不生成证书、不启用 HSTS、不声称完成 TLS；
- 不创建 `v*` tag，不触发 Docker Hub 发布，不远程部署；
- 镜像发布只读取 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`；
- 正式域名、TLS、线上 Compose、升级、回滚和恢复演练延期到部署阶段。

## 下一步执行顺序

1. 用户确认 GitHub 自托管 runner 可用（必要时配置 Docker Hub Secrets），重跑
   `quality`，要求 `checks`、`image-build`、`e2e` 在**同一个 main SHA** 全绿，
   且 Compose 静态检查实际执行到；
2. 用户执行 T34-F8：公开端与管理端视觉验收，三个固定视口重放；
3. 新上下文独立 Review 给出 `PASS`；
4. 用户确认后再勾选 `T34-F8` 与 `GATE-C1`，然后才进入 T35。

## 用户验收清单（T34-F8）

启动方式见 `CLAUDE.md`「本地查看前端与人工验收」。

公开端（`http://127.0.0.1:3000`）：

- 首页区块顺序为 Hero → 精选作品 → 统一业务入口 → 当前领养 → 页脚；
- 首页与委托页大图、首页两个业务入口**无水印**；
- 作品列表、作品详情、领养列表与设定图**仍有水印**；
- 作品详情竖图限宽显示，切换作品后图集回到第一张；
- `/about#contact` 的邮箱与 QQ 与管理端官方渠道一致；
- 三个视口 390×844、768×1024、1440×900 无横向滚动、图片正常解码。

管理端（`http://localhost:3000`）：

- 「文案配置」官方渠道 Card 可同时编辑官方邮箱、QQ、抖音号与防诈骗提醒，
  一次保存生效；
- 「大图管理」首屏设置只有首页口号与轮播设置，并提示官方渠道去文案配置修改；
- 两个浏览器窗口同时编辑同一分区：第二个得到分区级冲突且保留草稿；
  编辑不同分区：都能保存成功。

运维（可选）：

- `pnpm media:reconcile-site-display` 默认输出 dry-run 数量摘要；
  加 `--no-dry-run` 才真正补齐既有素材变体。
