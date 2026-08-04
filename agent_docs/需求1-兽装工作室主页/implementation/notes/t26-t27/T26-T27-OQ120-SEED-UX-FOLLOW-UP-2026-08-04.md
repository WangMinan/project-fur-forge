# T26–T27 · OQ-120 默认值与界面跟进（2026-08-04）

## 结论

- 用户确认 OQ-120 全部 10 项正式文字；新增 `0014_seed_confirmed_site_content.sql`，只补 `site_content` 空字段并插入缺失的委托/领养营业状态，不覆盖管理员已有值。
- `/admin/site/home` 的导航、一级标题和浏览器标题统一由“首页管理”改为“**大图管理**”，准确覆盖“首页大图 / 委托页大图”两个 Tab。
- `/commission#commission-details` 使用 80px 滚动偏移；真实浏览器首次以 64px 复测仍被页头遮挡约 9px，修正后目标区块完整位于固定页头下方。
- 返图墙范围没有取消：T35 建模、T36 建设上传/管理/公开墙，均在 T34 之后的 P1；实现前继续不进入可点击导航。

## 数据库结果

- `pnpm db:migrate`：应用 1 项迁移，自动生成迁移前备份 `.data/backups/pre-migrate-2026-08-04T15-36-03-611Z.db`。
- 当前开发库：15 项迁移，`integrity_check = ok`，`site_content.version = 19`。
- 已核对：5 项 FAQ、关于页事实、制作范围、著作权与一年保修条款、防诈骗文字，以及 `commission` / `adoption` 两条 `limited` 营业状态。
- 已确认不含用户拒绝的“私人联系方式不会公开”防御性表述。

## 验证

- `pnpm test`：16 个文件、102 项通过。
- `pnpm test:integration`：12 个文件、95 项通过。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`：通过。
- `admin-home.spec.ts` 与 `t26-t27-visual-follow-up.spec.ts` 首轮 18/19 通过，并准确暴露 64px 偏移不足；调整为 80px 后，锚点真实点击定向用例通过。
- 浏览器覆盖导航/标题一致性、首页与委托页大图工作流、三视口无横向溢出及锚点与固定页头的位置关系。
