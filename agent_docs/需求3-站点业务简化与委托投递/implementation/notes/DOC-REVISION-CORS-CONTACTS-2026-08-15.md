# 需求3文档修订：OSS CORS 与官方联系方式

> **日期**：2026-08-15
> **类型**：用户追加产品/运维口径同步
> **范围**：纯文档；没有修改应用代码、数据库、OSS 控制台或生产数据。

## 1. 用户决定

1. 当前 OSS Bucket CORS 均使用通配 Origin，后续继续保持 `AllowedOrigin=*`。
2. 不把“改为精确 public/admin Origin”“禁止 wildcard”或 CORS 收紧结果作为实现、CI、验收或生产门禁。
3. 应用匿名 API 的 Origin、token、TTL、限流、蜜罐、摘要、MIME、尺寸和一次性消费校验继续保留；CORS 通配不代表放宽这些应用安全边界。
4. 官方联系方式只继续维护邮箱、QQ、QQ群。
5. 抖音、小红书和 Bilibili 的账号、二维码、管理槽位和公开卡片不再维护。

## 2. 对前一轮文档复查的覆盖

前一轮 `DOC-REVIEW-2026-08-15.md` 曾把“私有 Bucket 精确允许 public/admin Origin、production 禁止 wildcard”列为修正项。该项现已被用户明确覆盖，不再是当前契约，也不得在独立 Review 中作为 finding。

前一轮保留“旧 contact 兼容列不在需求3删除范围”的结论也按本次决定细化：

- `contact_qq` 不强制删除；
- `contact_douyin` 因抖音渠道被明确取消，进入第一发布单元的迁移删除范围；
- `official_channels_json` 目标固定为 `qq | qq_group`；
- `xiaohongshu`、`bilibili` 仅存在于旧 JSON/枚举时直接移除。

## 3. 数据与媒体口径

- 迁移按 platform 提取 QQ、QQ群，不依赖旧五项数组下标；
- 取消平台账号不导出、不转备注、不保留隐藏兼容投影；
- 取消平台二维码引用移除后，只删除确认没有其它引用的 `contact_qr` 私有源图、preprocess、公开派生、历史版本和 ESA cache；
- 邮箱继续独立保存和公开展示；
- `/about` 最终显示邮箱、QQ、QQ群；`/commission` 直接显示 QQ、QQ群。

## 4. 已同步活文档

- `CLAUDE.md`
- `agent_docs/README.md`
- 需求3 `STATE.md`
- `foundation/README.md`
- `requirements/SPEC.md`
- `models/README.md`
- `.design/README.md`
- `planning/PLAN.md`
- `planning/DATA-MIGRATION.md`
- `implementation/TASKS.md`
- `implementation/EXECUTION_ROUTING.md`
- `review/REVIEW.md`

## 5. 未发生的操作

- 未修改 OSS CORS；
- 未删除任何联系方式或二维码资产；
- 未运行迁移；
- 未修改代码或测试；
- 未执行生产发布。
