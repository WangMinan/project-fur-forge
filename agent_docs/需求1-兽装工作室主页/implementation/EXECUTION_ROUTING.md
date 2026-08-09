# 执行责任路由

> **角色**：记录阶段 E/F 的执行顺序、写入边界和交接要求。
> **最后校准**：2026-08-09。
> **当前门禁**：阶段 D 已经用户验收；独立综合 Review 保留到 T49。

## 1. 角色

| 角色 | 责任 |
| --- | --- |
| `BACKEND_PRIMARY` | 迁移、Schema、API、统计、媒体签名、OSS/CDN operation、恢复和投影 |
| `FRONTEND_PRIMARY` | Vue 页面、公开采集、管理统计、品牌、响应式与无障碍 |
| `REVIEW` | 新上下文独立审查契约、代码、浏览器、媒体、安全、隐私、成本和证据 |
| `ACCEPTANCE` | 用户业务/视觉/生产操作确认与门禁签署 |

默认分工：GPT-5.6 Sol 为后端；前端由用户逐任务指定；GPT-5.6 Sol 可在新的独立上下文 Review。联合任务按后端 → 前端 → Review → 用户验收串行，实施者不能代签 Review。

## 2. 当前写入范围

允许：

1. T46 第一方访问统计；
2. T49 发布级 CI 与阶段 D/E 综合 Review；
3. T50 全站回归；
4. T51 备案/导航品牌/正式素材；
5. T52-F1～F7 生产媒体、CDN、正式环境与 Handbook；
6. T53 用户验收与文档闭环。

禁止恢复邮件找回、CSV、原图档案 UI、高级批量运维 UI，也不新增 Bucket、异地灾备、公开读兼容、分享 URL、DDoS 高防或 ESA。

## 3. T46 路由

### BACKEND_PRIMARY

1. 新前向迁移 `analytics_events` 与索引；
2. 共享白名单事件/route/action Schema；
3. sessionStorage 随机值的域分离 HMAC；
4. 同源公开写接口、body limit、限流与稳定错误；
5. 90 天幂等清理；
6. 今日/7/30 天管理聚合；
7. 确认不保存 IP、UA、Referer、query、联系方式、Cookie/指纹；
8. 迁移、并发、重复、清理、隐私和查询计划测试；
9. 实施 note 与后端交接。

### FRONTEND_PRIMARY

1. 公开端 sessionStorage 会话与 `sendBeacon`/keepalive；
2. 只上报白名单 route/entity/action；
3. 失败不影响页面或导航；
4. `/admin/analytics` 今日/7/30 天最小视图；
5. 统计措辞使用“近似会话”，不称精确独立访客/转化；
6. 三视口、空态、错误和加载；
7. 与用户确认隐私政策最终公开文字，未确认不持久化。

### REVIEW / ACCEPTANCE

Review 复核数据最小化、HMAC、90 天清理、限流、日志/DTO/HTML 泄漏、统计定义和采集失败降级。PASS 后用户确认统计含义及隐私公开文案。

## 4. T49/T50 路由

T49 必须由新上下文：

- 复现/修复历史 CI；
- 同一最新 SHA 取得 `checks`、`image-build`、`e2e` 全绿；
- 独立 Review 阶段 D 最终代码和 T46；
- 冻结初始 finding，不删除 NOT PASS 历史；
- 禁止删除测试、放宽类型/安全/媒体/隐私断言。

T50 基于同一 SHA 在管理/公开 Host 和三视口重放全站、409/失败/恢复、媒体、console/network、键盘/焦点与进程中断。T50 不替代目标云环境验证。

## 5. T51 路由

FRONTEND_PRIMARY 新增独立 `PROJECT_NAV_NAME='有点小狗'`，只接入公开桌面导航、移动导航和登录页公开壳。不得用全局替换误改 `ownerDisplay`、条款、版权、关于或 SEO 组织名。

用户提供/确认备案号、正式域名和素材，完成三视口品牌/备案验收。

## 6. T52 后端/配置路由

### T52-F1 · Endpoint

- 将服务端 OSS 客户端与浏览器上传签名客户端/URL 分离；
- 生产 `OSS_ENDPOINT` 是杭州内网，`OSS_UPLOAD_BASE_URL` 是私有 Bucket 公网域名，`MEDIA_BASE_URL` 是 CDN；
- 当前 `OSS_UPLOAD_BASE_URL` 未被签名链使用，必须用返回 URL Host 测试证明已接线；
- 同步 `.env` 生产实例、示例、runtime、verify、preflight、部署文档；
- 不增加新 AK/SK。

### T52-F2 · OSS preflight

- 现有两只 Bucket 直接 private + BPA；
- 审计 Object ACL/Policy/CORS；
- 原始 OSS 匿名 403；
- 应用精确权限通过、越权拒绝；
- CDN 只回源衍生 Bucket；
- 旧 preflight 的 public-read/匿名 200 断言必须被重写，不能兼容保留。

### T52-F3/F4 · CDN

- 单一 CDN URL signer，方式 A、86400 秒、主备 Key；
- 所有公开 SourceSet 动态签名，数据库不存完整 URL；
- 查询参数收敛和缓存策略；
- 下架 operation 先撤销投影，再精确 OSS 删除 + `Force=true` File refresh；
- 保存任务 ID/状态并查询，进程重启可恢复；
- 完整签名 URL/Key 不进日志。

### T52-F5 · 成本

- 先测页面字节、命中、并发/峰值，再由用户定预算/封顶；
- 用量封顶、预算、CDN/ECS/证书/DDoS 基础防护监控；
- 不把预算写成硬限制，不隐瞒 CDN 约 10 分钟延迟。

## 7. T52 前端/浏览器路由

- 确认所有公开图片为 CDN Host，src/srcset 不含 OSS；
- URL 过期后重载页面获得新 URL；
- 公开页面在 Referer 白名单下真实浏览器可用；
- 管理上传 URL 公网可达且无 internal；
- 下架 UI 分别表达页面已下架、CDN 刷新中/完成/失败；
- 三视口、私密模式、console/network、图片解码、错误与恢复。

## 8. T52 云上操作与用户交接

实施者完成代码/自动门禁后，用户按 [`PRODUCTION-LAUNCH-HANDBOOK.md`](./PRODUCTION-LAUNCH-HANDBOOK.md) 执行：备案/域名、CDN、ACL/BPA、CORS、RAM、生产 env、封顶预算、空卷部署、备份恢复、切换与验收。

需要用户真实控制台操作的项不能由 Agent 预先勾选；用户提供脱敏证据后，REVIEW 在新上下文复核，最后由用户完成 T53。

## 9. 写入纪律

- 最新 `main` 直接串行，不建分支/PR；
- 小提交、可回滚，不 force push/硬 reset；
- 不删除/清空 `.env`，不回显 Secret；
- 不重写历史迁移；
- 不把 Bucket 改回 public-read 作为回滚；
- 不创建 `v*` tag、不触发正式镜像发布，除非用户明确授权；
- OSS/CDN 集成有费用，只跑当前任务必要的真实测试；
- 独立 Review 与用户验收分别记录。

## 10. 文档交接

每项至少更新 STATE、TASKS、PLAN、SPEC，涉及媒体再更新媒体策略/OSS preflight/Handbook，涉及模型再更新 models，涉及 UI 再更新 design，最后更新 artifacts/notes 索引与 `CLAUDE.md` 稳定纪律。

实施 note 保留范围、非目标、迁移、首次失败、finding、修复、命令、浏览器/云证据和未验证边界。测试数量不能替代真实页面、媒体、刷新和恢复观察。
