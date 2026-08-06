# 执行责任路由

> **角色**：记录阶段 C.1 剩余工作的执行顺序、写入边界和交接要求。
> **最后校准**：2026-08-06。
> **当前门禁**：T34-F8 与 GATE-C1 未通过。

## 1. 当前角色

| 角色 | 责任 |
| --- | --- |
| `BACKEND_PRIMARY` | 数据库、Schema、API、媒体、operation、恢复、部署相关业务能力 |
| `FRONTEND_PRIMARY` | Vue 页面、组件、状态、响应式、无障碍与视觉接线 |
| `REVIEW` | 契约、代码、Actions、浏览器、媒体、安全、性能和证据复核 |
| `ACCEPTANCE` | 用户最终业务与视觉确认，负责 T34-F8 |

下一轮本地 Codex GPT-5.6 Sol 可以同时承担后端和必要前端修复，但不能为自己的实现代签独立 Review。

## 2. 本次配置提交后的起点

本次提交只完成文档与交付配置收口：

- 修订 Dockerfile；
- `compose.yaml` 改为 `docker-compose.yaml`；
- 修订 Compose 网络、Nginx 和环境示例；
- 升级 GitHub Actions 并修正 Compose 检查；
- 新增 Dependabot；
- 更新当前状态和任务。

没有修改 `app/`、`server/`、`shared/`、`tests/`、迁移或 package/lockfile。下一轮 Codex 必须从本次提交触发的最新 Actions 日志开始，不得只引用旧的本地“全部通过”记录。

## 3. 下一轮严格执行顺序

### 第一步：恢复远端门禁基线

1. 拉取最新 main；
2. 查看本次提交触发的 `quality` 三个 job；
3. 修复 `ControlBody.placement` 等真实 TypeScript/E2E 错误；
4. 不跳过、不降级 lint、typecheck、unit、integration、build、verify 或 E2E；
5. 若 `image-build` 仍失败，只根据新日志做最小 Docker/依赖修复；
6. 取得至少一次最新 main 的完整 Actions 结果。

### 第二步：合并完成 T34-F4 与 T34-F5

先建立 characterization tests，再形成：

- Hero repository/service/publication runner；
- work publication runner；
- watermark profile service/apply runner；
- media recipe/generator；
- public projection repository；
- operation lease/heartbeat/recovery 公共基础设施。

必须覆盖：

- HOME PUBLISH；
- HOME UPSCALE；
- WORK PUBLISH；
- WORK UNPUBLISH；
- WATERMARK PREVIEW/REBUILD/APPLY；
- 后续站点展示 reconcile。

真实杀死 Node 进程并在生成、验证、提交边界重启。不能只直接调用 runner 两次模拟重启。

### 第三步：完成 T34-F1 既有媒体 reconcile

增加持久、幂等命令或 operation：

```text
media:reconcile-site-display
```

或语义等价入口，扫描启用 Hero、委托 Hero、委托入口和常规领养入口源。要求：

- 不依赖手动禁用再启用；
- 完整生成后原子切换；
- 失败保留旧投影；
- 清理只针对当前 attempt；
- 可恢复、可重试、可审计；
- 真实双 Bucket 验证；
- profile 切换只影响水印变体。

### 第四步：关闭 T34-F2/F3 小缺口

- 首页内容顺序与 `.design/public-site/INFORMATION_ARCHITECTURE.md` 统一；
- 邮箱、QQ、抖音和防诈骗说明统一到一个可编辑官方渠道 Card；
- 保持分区并发，不恢复全局整包版本；
- 两个管理上下文验证并发；
- 三固定视口验证首页与横竖作品详情。

### 第五步：严格 readiness

readiness 必须复用现有迁移 history/hash 校验，不只比较数量；响应仍不能泄漏数据库路径、SQL、Object Key、Secret 或异常栈。

### 第六步：总门禁交付

运行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm verify:production
pnpm test:e2e
```

并检查 GitHub Actions：

- `checks` 成功；
- `image-build` 成功；
- `e2e` 成功。

本地禁止：

- `docker build`；
- `docker compose up`；
- `docker run`；
- 空卷、Nginx、TLS 或线上部署演练。

## 4. 写入纪律

- 继续直接在最新 `main` 串行推进；
- 小提交、可回滚，提交信息带 T34-F 编号；
- 不 force push、不硬 reset；
- 不删除或清空 `.env`；
- 不重写已经执行的历史迁移；
- 不通过泄漏私有原图、关闭作品水印或放宽安全检查让测试通过；
- 不创建 `v*` tag，不触发镜像发布；
- 不进入 T35。

## 5. 文档交接

每个剩余任务都更新：

- [`../STATE.md`](../STATE.md)；
- [`TASKS.md`](./TASKS.md)；
- [`../review/REVIEW.md`](../review/REVIEW.md)；
- 对应 `implementation/notes/t34-c1/` 记录。

实施记录必须包含首次失败、新发现、修复、测试命令和未验证边界。测试通过数量不能替代真实浏览器与进程重启证据。

## 6. 用户验收

Codex 完成 T34-F1–F7 后：

- 保持 T34-F8 未勾选；
- 保持 GATE-C1 未通过；
- 输出清晰的用户验收清单；
- 等待用户查看公开端和管理端；
- 用户明确确认后，才由后续文档提交勾选 T34-F8 和 GATE-C1。
