# T13 · 数据与安全回归

> 日期：2026-08-12
> 基线：`7d03a22`
> 结论：**PASS**。

## 回归矩阵

| 边界 | 直接证据 | 结果 |
|---|---|---|
| 空库迁移、重复迁移 | `database.test.ts` 根据 journal 验证完整迁移与幂等 | PASS |
| 既有库迁移 | 新增 `0031` 前后 analytics 事件保留与 `updates` route 写入测试 | PASS |
| foreign key / integrity / 索引 | 升级后 `foreign_key_check=[]`、`integrity_check=ok`、route 索引存在 | PASS |
| Schema strict | site content、动态、request body、runtime boundary unit | PASS |
| 二维码私有边界 | contact QR integration 断言公开 DTO 无 `qrCodeAssetId`、`/original/`、私有下载或 OSS 签名参数 | PASS |
| 动态公开投影 | SQL 只公开 published；DTO 无状态、版本、内部时间、Key 或签名 URL | PASS |
| 首页动态降级 | 查询失败只关闭 `latestUpdates`，Hero 与其它首页区块可用 | PASS |
| Host / Origin / CSRF | `auth-api` 与 health integration 覆盖双 Host 404、错误/缺失 Origin、缺失 CSRF 与未知 Host | PASS |

## 本轮修复

- 为 `0031_requirement_2_updates_analytics.sql` 增加既有库升级测试：旧库先写入 `home` 事件并确认不能写 `updates`，升级后旧事件保留且新 route 可写，索引和完整性均正常；
- 修正 `auth-api` 的过期 fixture 版本断言：T06 的 `0029` 迁移已幂等追加邮件估价 FAQ 并把 `commissionFaqVersion` 从 1 推进到 2，因此本测试按当前迁移后的权威版本执行 CAS。没有放宽 Schema、Host、Origin、CSRF 或私有字段断言。

## 执行结果

| 命令范围 | 结果 |
|---|---|
| database / contact QR / public updates / home degradation / auth API / health integration | 39/39 PASS |
| site content / update / runtime / request body / analytics unit | 29/29 PASS |

T13 只补回归证据，不增加产品功能。T14 继续运行全量测试、lint、typecheck 与生产构建；T15 再以真实浏览器复核跨 Host 和三视口交互。
