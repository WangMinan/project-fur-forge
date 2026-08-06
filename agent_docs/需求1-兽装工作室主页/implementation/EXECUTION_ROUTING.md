# 执行责任路由

> **角色**：记录阶段 C.1 剩余工作的执行顺序、写入边界和交接要求。
> **最后校准**：2026-08-07。
> **当前门禁**：T34-F8 与 GATE-C1 未通过。

## 1. 当前角色

| 角色 | 责任 |
| --- | --- |
| `BACKEND_PRIMARY` | 数据库、Schema、API、媒体、operation、恢复、部署相关业务能力 |
| `FRONTEND_PRIMARY` | Vue 页面、组件、状态、响应式、无障碍与视觉接线 |
| `REVIEW` | 契约、代码、Actions、浏览器、媒体、安全、性能和证据复核 |
| `ACCEPTANCE` | 用户最终业务与视觉确认，负责 T34-F8 |

下一轮本地 Codex GPT-5.6 Sol 可以同时承担后端和必要前端修复，但不能为自己的实现代签独立 Review。

## 2. 当前起点

T34-F1 至 T34-F6 的实施工作已完成并推送 main。本地完整非 Docker 门禁通过：
lint、typecheck、unit、integration、build、verify:production、secret scan 与
E2E（均以 `APP_ENV=test` 执行，与 CI 一致）。

后端已形成五层边界，位置就是层次：

```text
server/utils/{repository,service,runner,recipe,route}/
```

`server/routes/` 是 Nitro 文件路由（每个文件对应一个公开 URL），与
`server/utils/route/`（handler 调用的辅助层）不是同一件事，**不要合并**。

## 3. 剩余执行顺序

### 第一步：远端门禁（阻断项，需用户参与）

最近几次 push 的 `checks` 与 `image-build` 以
`The job was not acquired by Runner of type hosted` 结束，`e2e` 因
`needs: checks` 跳过。这是自托管 runner 未接单，不是代码失败。

用户确认 runner 可用后重跑 `quality`，要求：

- `checks` 成功，且 `docker compose -f docker-compose.yaml config --quiet`
  真正执行到；
- `image-build` 成功；
- `e2e` 成功；
- 三者在**同一个 main SHA**。

不得把不同 SHA 的成功结果拼成一次"全绿"。

### 第二步：T34-F8 用户验收

验收清单见 [`../STATE.md`](../STATE.md)「用户验收清单」。实施者不代签。

### 第三步：新上下文独立 Review

必须使用浏览器与视觉模拟真实点击，区分管理/公开 Host。给出 `PASS` 后，
才由后续文档提交勾选 `T34-F8` 与 `GATE-C1`。

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
