# T07 · 公开名称搜索契约

## 范围

- 新增 shared 纯函数，统一 trim、`toLocaleLowerCase('zh-CN')` 与包含匹配，并回接后台作品列表。
- 三个公开 Query Schema 增加同名 `q`：缺失或纯空白表示未搜索，trim 后有效长度为 1～100 字。
- 数组、对象、非字符串和超过 100 字收敛为空结果，不抛 500，也不退回完整列表。
- 不增加搜索服务、依赖、公开 DTO 字段、页面搜索表单或 analytics 记录。

## 实现

- 作品与领养在既有公开快照分页前按 `characterName` 过滤；领养方式数量基于搜索后的结果计算。
- 返图只读取公开照片 ID 与 `return_characters.name`，先过滤匹配设定的所有返图，再按既有 SHA-256 seed 顺序随机并分页。
- SQLite 与 fake 作品 repository 使用同一规则，三个 API 路由只透传原始 `q`，repository 负责受控解析。

## 验证

- 定向 unit：3 files、7/7，覆盖中英文、大小写、首尾空白、空值、数组、对象、超长值及三个 Query Schema 同契约。
- 定向 integration：2 files、27/27，覆盖作品/领养名称过滤、非法值空结果、同设定多张返图全部命中与固定 seed 稳定顺序。
- `pnpm lint`、`APP_ENV=test pnpm typecheck`、`git diff --check`：通过。
- 首次未设置 `APP_ENV=test` 的集成命令被测试替身守卫拦截；按仓库规定设置环境后全部通过。新增领养断言最初误用 slug 搜索，已修正为设定名称后通过。

## 结论

`PASS`。T07 完成；T08 负责三个页面的 GET 搜索表单、分页/筛选查询保留与搜索空态，T09 浏览器验证仍保持开放。
