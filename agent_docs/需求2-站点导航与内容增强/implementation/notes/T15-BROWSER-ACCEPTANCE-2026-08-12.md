# T15 · 三视口真实浏览器验收准备

> 日期：2026-08-12
> 基线：`cb90454` + T15 浏览器回归补丁
> 结论：**PASS WITH USER FOLLOW-UP**。

## 覆盖范围

- 公开端固定使用 `http://127.0.0.1:<port>`，管理端固定使用 `http://localhost:<port>`；
- 视口固定为 390×844、768×1024、1440×900；
- 导航 hover/focus 与移动菜单、三个公开目录搜索组合、动态新增/编辑/发布/下架、管理账号响应式溢出、五平台二维码公开投影、关键页面 console/network；
- Edge 真实进程和隔离 SQLite/Fake OSS，不访问生产 Bucket，不修改生产数据。

## 首次发现与修复

1. 管理导航既有 E2E 仍断言 7 个入口，漏掉 `/admin/updates`。已更新为 8 个入口，并校验“动态管理”的路由、标题与当前页状态。
2. 三视口管理验收原先只验证页面无横向滚动，没有显式检查宽屏用户名和窄屏隐藏。已补 390/768 隐藏、1440 显示 `e2e-admin` 与退出按钮可达断言。
3. 现有二维码 E2E 使用普通方形噪点图；进一步目视截图发现 FakeMediaStorage 把公开派生固定替换成渐变占位，因此旧断言只能证明图片载入，不能证明 QR 像素保留。已改用固定真实 QR PNG（内容为 `https://example.test/ditedog-contact`），仅让 `contact-qr-v1` 假存储派生保留源像素，并在 integration 层断言两个公开输出字节等于真实 QR 源图。普通媒体 recipe 仍使用原来的小型占位，不改变生产实现。
4. 新的总体验收最初等待 `networkidle`，首页持续请求会让该条件超时。改为等待公共/管理壳可见及短暂稳定窗口，直接收集 console error、HTTP ≥400 与 requestfailed。
5. Playwright 在 Windows 上所有断言结束后无法退出 webServer；运行器最终被外层超时回收。测试报告中的用例结果均为 PASS，超时只发生在服务清理阶段，本记录不把它描述为标准退出成功。

## 验证结果

| 验证 | 结果 |
|---|---|
| 既有导航、联系配置、动态管理及 T15 总体验收 E2E | 24/24 PASS |
| T15 双 Host / 三视口 / console-network 总体验收定向复跑 | 1/1 PASS |
| 真实 QR 五平台三视口冷构建 Edge 复跑 | 1/1 PASS |
| `contact-qr-media` integration（真实 QR 公开字节） | 1/1 PASS |
| T15 相关文件 ESLint | PASS |
| `git diff --check` | PASS |

真实 QR 截图位于 [`t15/screenshots`](./t15/screenshots/)：三个公开五平台视口和三个管理账号视口。目视确认 2/3/5 列响应式排列、长账号换行、QR 黑白模块、窄屏管理导航及宽屏账号区均无横向溢出。

## 人工后续

当前 Edge 环境不提供 `BarcodeDetector`。自动化已证明真实 QR PNG 的源像素经过测试媒体链后仍进入公开 `<img>` 并在三视口正确显示，但不会代签物理手机相机扫码。用户需在 T17 使用实际联系方式二维码完成手机扫码和真实账号确认。

T15 只关闭浏览器验收准备；T16 独立 Review 与 T17 用户验收仍保持开放。
