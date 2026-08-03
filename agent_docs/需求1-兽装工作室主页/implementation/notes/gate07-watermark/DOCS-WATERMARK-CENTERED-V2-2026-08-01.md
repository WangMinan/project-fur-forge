# 居中可配置品牌水印契约校准（2026-08-01）

> **范围**：只修改 `agent_docs`，不修改 Vue/TypeScript、数据库、迁移、OSS 对象或运行配置；T14–T18 的完成状态保持不变。
> **触发**：景宸在 S4 前要求把现有左上小水印调整为大尺寸居中水印，并允许从管理端更新/选择后续使用的 Logo 水印源。用户建议默认 50% 不透明度并居中。

## 1. 代码与文档交叉确认

| 项目 | 当前实现 | 结论 |
| --- | --- | --- |
| 水印源 | `server/utils/media-recipe.ts` 只从构建产物或 `public/brand/logo-full-light.png` 读取本地文件，再上传到固定私有路径 | 不能由景宸运行时选择；更新 Logo 依赖改代码/构建 |
| 位置与尺寸 | `brand-standard-v1` 固定最终宽度 18%、不透明度 70%、24px 边距；位置读取单图四角锚点 | 与“大型居中、50%”新要求冲突 |
| OSS 参数 | 处理字符串使用四角 `g_nw/ne/sw/se` 和 `x/y`，没有 `g_center`；测试明确禁止 `P_` | 需要新 profile 和真实 OSS 契约测试 |
| 数据模型 | `assets`、`work_assets`、上传 Schema 和 DTO 只允许四角，不存在 `watermark_logo`、活动 profile 或站点品牌配置 | 无法表达可选水印源、中心位置和原子切换 |
| 发布检查 | 作品发布检查硬编码 `brand-standard-v1` 和单图锚点 | 配置更新后旧 variant 可能继续被误认为完整 |
| 管理端 | 作品卡只有“水印安全角”下拉框；AdminShell 只有作品/账号；无全站水印页面、真实水印配置预览或再生成进度 | 前端缺少完整配置闭环 |
| 既有文档 | PLAN/模型/设计明确把 Logo 当部署资产，使用四角、18% 并将最终参数推迟到 T51 | 必须在 S4 前做跨层校准 |

## 2. 阿里云 OSS 约束核对

本轮采用官方水印参数语义：

- `g=center` 支持把水印放在画面中部；
- `t` 取值 0–100，100 表示完全不透明，因此默认使用 `t=50`；
- 图片水印支持 `P` 按目标图比例缩放，本轮默认 `P=60`；
- 水印图片必须先放入与处理源相同的 Bucket，Object 完整名称进行 URL-safe Base64 编码；
- 私有对象通过 SDK/API 处理，继续使用现有服务端 OSS 链路。

## 3. 产品与技术决定

- 新增 `brand-centered-v2`，固定居中，默认 50% 不透明度、60% 缩放；管理端可在 10–90 和 20–90 的受限范围内调整不透明度/缩放，不能关闭水印或改回角落。
- 新增站点级 `watermark_logo` 候选资产和 `/admin/site/branding`；管理员上传/选择 assetId，不接触路径或 Key。
- 当前随应用 Logo 导入为初始候选；运行时不再把本地路径作为唯一活动源。
- 新增不可变 watermark profile、站点活动/草稿引用和再生成操作；variant identity 引用 profile。
- 配置应用采用完整生成与验证后原子切换；失败继续使用上一活动 profile。
- 旧 `brand-standard-v1` 和四角字段作为历史身份保留，不原位修改；v2 UI 删除单图安全角控件。
- 在 T19 前新增 `GATE-07`，由工程侧先实现模型/API/迁移与 S4 后端，再由 Kimi 完成品牌页面和公开页面，最后由工程侧收口。

## 4. 同步路径

- `foundation/WATERMARK-CENTERED-V2.md`
- `requirements/WATERMARK-CENTERED-V2.md`
- `planning/WATERMARK-CENTERED-V2.md`
- `models/WATERMARK-CENTERED-V2.md`
- `.design/WATERMARK-CENTERED-V2.md`
- `.design/README.md`
- `implementation/TASKS.md`
- `implementation/EXECUTION_ROUTING.md`
- `STATE.md`
- `artifacts/ARTIFACTS.md`
- `implementation/notes/README.md`
- `agent_docs/README.md`

## 5. 一致性检查

- T01–T18、GATE-06 和 EXT-02 仍保持完成；
- T19 不再是立即入口，下一门禁为 GATE-07；
- 依赖主链改为 `T18 → GATE-07 → T19 → T20 → T21`；
- 工程侧仍先锁定 Schema/API/权限/配方/事务，Kimi 再实现 UI；
- 私有原图无水印、公开 variant 烘焙水印、双 Bucket 和 OSS 唯一公开配方权威不变；
- 没有把参考图或竞品资产复制进仓库；
- 本轮只改文档，因此不运行代码门禁。后续 GATE-07 必须运行迁移、单元、集成、真实 OSS、浏览器、三视口和生产构建验证。
