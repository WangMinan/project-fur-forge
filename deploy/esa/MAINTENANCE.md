# ESA 计划维护页

[maintenance.html](maintenance.html) 是粘贴到 ESA 的唯一 HTML 源文件，UTF-8 大小必须小于 2,000 字节（保守兼容控制台 2 KB 限制）。它复用站点蓝白配色、中英并列文案，无脚本、外部字体、图片和接口依赖，无需上传 OSS。放在部署目录，不由 Nuxt 提供；服务器停机时由 ESA 返回已保存的副本。

本流程是手动维护开关，不检测源站故障。本地文件不自动同步到 ESA；控制台配置与实际请求结果分别验证。

## 生效记录（2026-09-25）

用户已确认 HTML、JSON 与维护规则完成配置并生效。此前规则和页面选择正确、blob 预览正常，但实际 GET 和内嵌浏览器仍显示 ESA 默认 503 页。

用户反馈原因是 ESA 对自定义 HTML/JSON 的审核，观察到约 24 小时后生效；这是本次使用反馈，不是已核实的固定审核时限或平台 SLA。后续新增或修改页面应提前提交，检查审核状态，并以真实测试 URL 返回预期正文和 503 为准；blob 预览与规则保存成功不能替代边缘生效验证。默认 503 页的 overloaded 文案也不能单独证明源站过载。

## 1. 创建页面（用户截图一）

ESA → 全局配置 → 自定义页面 → 拦截页面 → 创建拦截页面。

| 字段 | 内容 |
| --- | --- |
| 页面名称 | `ditedog_maintenance` |
| 备注 | `计划维护页，仅供维护响应规则引用` |
| 页面类型 | `text/html` |
| 页面源码 | 粘贴 maintenance.html 的全部内容，不含 Markdown 代码围栏 |
| 高级配置：生效站点 | 留空，不设为全局 WAF 默认拦截页面 |

保存。创建页面本身不会开启维护，后续在响应规则里显式引用它。不要把控制台提供的 403 示例 HTML 一并保留。

API 另建一个自定义页面：名称 `ditedog_maintenance_api`，类型 `application/json`，源码使用 [maintenance.json](maintenance.json)，全局生效站点同样留空。显式指定 JSON，避免将“无响应页面”视为已经实测保证空响应体；此 JSON 的实际 503 输出也需要预览验证。

## 2. 先用测试路径验证（用户截图二）

ESA → 站点管理 → 目标站点 → 规则 → 转换规则 → 自定义响应码 → 新增规则。

规则名称 `maintenance_preview`，传入请求类型选“自定义规则”，点击“编辑表达式”：

```text
(http.host eq "ditedog.com" and http.request.uri.path eq "/__esa_maintenance_preview")
```

公开 Host 为用户提供的 `ditedog.com`。管理 Host 按仓库部署记录使用 `admin.ditedog.com`；启用前确认其 DNS 记录仍处于 ESA 代理加速状态。不要使用所有传入请求或泛域名匹配。

响应码 `503`；响应页面 `ditedog_maintenance`。保存后访问该 Host 的 `/__esa_maintenance_preview`，检查页面、手机宽度、重试首页链接、响应状态和 Content-Type。用 GET 验证响应头，例如：

```powershell
curl.exe -sS -D - -o NUL https://ditedog.com/__esa_maintenance_preview
```

预期为 503、HTML 内容类型；首页仍正常。检查真实响应的 Cache-Control/Age 以及现有 ESA 缓存规则，不得给维护响应配置正 TTL 或强制缓存。HTML meta 不能替代 HTTP Cache-Control。若需额外配置响应头，目标为 `Cache-Control: no-store` 和 `Retry-After: 60`，须实测响应头规则能作用于边缘自定义响应；60 表示建议重试间隔，不承诺恢复时间。当前两个截图中的表单没有响应头设置项。

## 3. 正式维护规则

完成预览后先禁用预览规则。正式规则也先以仅匹配测试路径的条件创建、保存后禁用，再编辑为下面的正式条件；不要在正常营业时直接保存一条已启用的全站维护规则。

按下列顺序排列两条规则，同时覆盖公开与管理 Host；不包含 `public-media.ditedog.com` 或 OSS 上传域名。

### 第一条：API 返回 JSON 503

名称 `maintenance_api`，响应码 `503`，响应页面 `ditedog_maintenance_api`，放置位置选“第一条”：

```text
(http.host in {"ditedog.com" "admin.ditedog.com"} and (http.request.uri.path eq "/api" or starts_with(http.request.uri.path, "/api/")))
```

这条覆盖所有方法，阻止 API 在维护期间回源，也避免接口收到 HTML。现有前端仍可能显示通用请求失败提示，本变更未添加全局维护弹窗或表单恢复逻辑。

### 第二条：站点返回维护页

名称 `maintenance_site`，响应码 `503`，响应页面 `ditedog_maintenance`，放置位置选“最后一条”（最终确认排在 API 规则后面）：

```text
(http.host in {"ditedog.com" "admin.ditedog.com"})
```

该规则覆盖两个 Host 上剩余的所有请求和方法，包括管理登录页、管理页面和静态资源。自包含维护页不依赖这些资源；OSS 媒体域名因 Host 不匹配而继续按原规则工作。已有正常标签页不会主动切换，重新导航才会看到维护页。维护页的首页链接是同源 `/`，在管理域名上仍留在管理域名。

安全创建方式：新增表单没有禁用选项时，创建 API 规则先用 `(http.host in {"ditedog.com" "admin.ditedog.com"} and http.request.uri.path eq "/__esa_maintenance_api_preview")`；站点规则先用 `(http.host in {"ditedog.com" "admin.ditedog.com"} and http.request.uri.path eq "/__esa_maintenance_preview")`。保存仅命中预览路径。验证两个 Host 的 HTML/JSON 响应后，在列表关闭开关，再编辑为上面的正式表达式并保存，确认开关仍关闭。原 maintenance_preview 完成诊断后禁用，避免与新预览规则重叠。

不要另建 WAF 维护拦截规则，也不要更改已有 WAF 防护。第一条 API 规则必须排在第二条之前；自定义响应码规则命中第一条后即返回。

## 4. 每次开启与恢复

1. 开启 API 规则，再开启站点规则；在无痕窗口确认公开/管理主页和深链为维护页、两侧 API 为 JSON 503、已发布媒体仍可访问，再开始停机。
2. 重启 ECS 或更新容器；维护页仍由 ESA 返回。规则不是全量停写机制：已到达源站的请求、直连源站及后台任务仍按部署手册处理。
3. 按部署手册在服务器本地检查 app ready、Nginx 和目标版本；边缘维护期间不能用被拦截的公开 URL 判断源站就绪。
4. 源站就绪后先关闭站点规则，再关闭 API 规则；刷新验证正常页面、接口、媒体和无维护缓存残留。两次切换间应尽量短。
5. 保留禁用规则供下次使用；退出控制台不会自动解除维护。

维护是否完成以实际控制台状态和外部请求为准。此文件及普通应用发布不会自动同步 ESA 中的 HTML；更新后需要重新复制粘贴并预览。

## 官方依据

- [自定义页面](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/set-custom-page)：页面大小、命名、全局生效站点的作用。
- [自定义响应码](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/custom-response-code-new)：不回源的固定响应、规则顺序和启停。
- [WAF 自定义规则](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/waf-custom-rules)：安全防护的拦截与挑战，与计划维护响应用途不同。
