const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const prototypeRoot = path.resolve(__dirname, "..");
const screenshotDir = path.resolve(__dirname, "../screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function attachDiagnostics(page, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
}

async function startStaticServer() {
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".png": "image/png",
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(prototypeRoot, relativePath);
    if (!filePath.startsWith(prototypeRoot + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
      response.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/index.html` };
}

async function run() {
  const localServer = process.env.PROTOTYPE_BASE_URL ? null : await startStaticServer();
  const baseUrl = process.env.PROTOTYPE_BASE_URL || localServer.url;
  const executablePath = process.env.PLAYWRIGHT_BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({ headless: true, executablePath });
  const errors = [];
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await attachDiagnostics(desktop, errors);
    await desktop.goto(baseUrl, { waitUntil: "networkidle" });
    assert(await desktop.locator('[data-view="home"].is-active h1').isVisible(), "桌面首页主标题不可见");
    assert(await desktop.locator("body").evaluate((node) => node.classList.contains("home-route")), "首页没有启用全幅首屏导航层级");
    const desktopHeroHeight = await desktop.locator(".hero-cinematic").evaluate((node) => node.getBoundingClientRect().height);
    assert(desktopHeroHeight >= 890, "桌面首页首屏没有铺满可用视口");
    assert(await desktop.locator(".hero-background img").count() === 1, "首页首屏缺少代表作品图");
    assert(await desktop.locator(".hero-art").count() === 0, "首页仍保留文字/图片等权左右分栏");
    assert(await desktop.locator(".hero-lede").count() === 0, "首页首屏仍包含说明性长段落");
    assert(await desktop.evaluate(() => window.scrollY === 0), "首页初次打开后没有停留在首屏顶部");
    const homeSectionOrder = await desktop.locator('[data-view="home"]').evaluate((node) => {
      const selected = node.querySelector("#home-selected");
      const paths = node.querySelector(".business-bridge");
      return Boolean(selected && paths && (selected.compareDocumentPosition(paths) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(homeSectionOrder, "首页下滑后没有先进入精选作品");
    assert((await desktop.locator("body").evaluate((node) => node.scrollWidth)) <= 1442, "桌面首页存在横向溢出");
    assert(await desktop.locator('[data-work-grid="featured"] [data-work-id]').count() === 6, "首页精选未使用 6 件数据验证横向浏览");
    assert(await desktop.locator('#public-nav [data-route="home"]').isVisible(), "公开导航缺少可见的首页入口");
    assert(await desktop.locator('#public-nav [data-route="studio"]').textContent() === "关于我们", "公开导航未使用“关于我们”");
    assert(await desktop.locator(".prototype-ribbon").count() === 0, "公开页面仍存在原型切换浮条");
    assert(await desktop.locator("[data-mode-toggle]").count() === 0, "公开页面仍存在后台切换入口");
    assert(await desktop.locator(".site-footer > button").count() === 0, "公开页脚仍暴露后台入口");
    const publicCopy = await desktop.locator("#public-shell").textContent();
    [
      "先把边界讲清楚",
      "MINIMAL ANALYTICS",
      "状态由景宸后台维护",
      "按景宸后台人工顺序",
      "统一的出厂照负责证明工艺",
      "我已经有角色设定",
      "我想遇见一个新角色",
      "进入后台原型",
      "切换到后台原型",
    ].forEach((forbidden) => assert(!publicCopy.includes(forbidden), `公开站仍包含面向评审的说明文案：${forbidden}`));
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-home-v5.png"), fullPage: false });

    await desktop.locator(".business-bridge").scrollIntoViewIfNeeded();
    assert(await desktop.getByRole("heading", { name: "自设委托" }).isVisible(), "首页缺少自设委托图片入口");
    assert(await desktop.getByRole("heading", { name: "角色领养" }).isVisible(), "首页缺少角色领养图片入口");
    assert(await desktop.locator(".business-bridge .path-card > img").count() === 2, "委托/领养入口没有由作品图片承载");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-home-paths-v5.png"), fullPage: false });

    await desktop.locator('[data-work-grid="featured"]').scrollIntoViewIfNeeded();
    const carouselBefore = await desktop.locator("[data-carousel-viewport]").evaluate((node) => node.scrollLeft);
    await desktop.locator("[data-carousel-next]").click();
    await desktop.waitForTimeout(500);
    const carouselAfter = await desktop.locator("[data-carousel-viewport]").evaluate((node) => node.scrollLeft);
    assert(carouselAfter > carouselBefore, "精选作品右箭头没有推动横向浏览");

    await desktop.locator('#public-nav [data-route="works"]').click();
    assert(await desktop.locator('[data-view="works"].is-active').isVisible(), "作品页未激活");
    const compactHeaderHeight = await desktop.locator('[data-view="works"] .compact-page-head').evaluate((node) => node.getBoundingClientRect().height);
    assert(compactHeaderHeight < 290, "作品页页头仍然过高");
    assert(await desktop.locator('[data-work-grid="all"] [data-work-id]').count() === 6, "作品页没有显示全部 6 件作品");
    const cardWidths = await desktop.locator('[data-work-grid="all"] .work-image').evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.getBoundingClientRect().width));
    assert(Math.max(...cardWidths) - Math.min(...cardWidths) < 1, "作品页首行卡片没有严格等宽");
    await desktop.locator('[data-filter-purpose="adoption"]').click();
    assert(await desktop.locator('[data-work-grid="all"] [data-work-id]').count() === 2, "作品用途筛选没有筛出 2 件领养作品");
    assert(await desktop.locator("[data-work-result-count]").textContent() === "2 件作品", "筛选结果计数未同步");
    await desktop.locator('[data-filter-suit="全装"]').click();
    assert(await desktop.locator('[data-work-grid="all"] [data-work-id]').count() === 1, "作品用途与装型没有按交集筛选");
    await desktop.locator('[data-filter-purpose="all"]').click();
    await desktop.locator('[data-filter-suit="all"]').click();
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-works-v5.png"), fullPage: true });
    await desktop.locator('[data-view="works"] [data-work-id]').first().click();
    assert(await desktop.locator("#work-dialog").evaluate((dialog) => dialog.open), "作品详情弹窗未打开");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-work-detail-v5.png"), fullPage: false });
    await desktop.locator("#work-dialog .dialog-close").click();

    await desktop.locator('#public-nav [data-route="home"]').click();
    assert(await desktop.locator('[data-view="home"].is-active').isVisible(), "首页导航入口无法返回首页");

    await desktop.locator('#public-nav [data-route="adoptions"]').click();
    await desktop.locator('[data-view="adoptions"] [data-adoption-id="ash"]').click();
    assert(await desktop.locator("#adoption-dialog").evaluate((dialog) => dialog.open), "领养详情弹窗未打开");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-adoption-detail-v5.png"), fullPage: false });
    await desktop.locator("#adoption-dialog .dialog-close").click();

    await desktop.locator('#public-nav [data-route="commission"]').click();
    assert(await desktop.locator('[data-view="commission"].is-active').isVisible(), "自设委托页未激活");
    assert(await desktop.locator(".commission-showcase > img").isVisible(), "自设委托页没有先用代表作品图建立制作气质");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-commission-v5.png"), fullPage: false });
    assert(await desktop.locator(".faq-list details").count() === 5, "自设委托页没有展示 5 条 FAQ");
    const faqItem = desktop.locator(".faq-list details").nth(1);
    await faqItem.locator("summary").click();
    assert(await faqItem.evaluate((node) => node.open), "FAQ 条目无法展开");
    await desktop.locator(".commission-faq").scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-commission-faq-v5.png"), fullPage: false });

    await desktop.locator('#public-nav [data-route="returns"]').click();
    assert(await desktop.locator('[data-view="returns"].is-active').isVisible(), "返图页未激活");
    assert(await desktop.locator(".returns-preview .return-skeleton-card").count() === 8, "返图页瀑布流骨架数量不正确");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-returns-v5.png"), fullPage: true });

    await desktop.locator('#public-nav [data-route="studio"]').click();
    assert(await desktop.locator('[data-view="studio"].is-active').isVisible(), "关于与基本约定合并页未激活");
    assert(await desktop.locator(".terms-list article").count() === 7, "基本约定没有覆盖锁定的七类内容");
    assert(await desktop.locator(".privacy-note").count() === 0, "关于我们仍显示不必要的分析或隐私说明卡片");
    assert(await desktop.locator('[data-view="terms"]').count() === 0, "基本约定仍被保留为独立一级页面");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-about-v5.png"), fullPage: true });

    await desktop.locator(".header-contact").click();
    assert(await desktop.locator('[data-view="contact"].is-active').isVisible(), "联系页未激活");
    assert(await desktop.locator(".header-contact").evaluate((node) => node.classList.contains("is-active")), "联系入口没有同步激活状态");
    assert(!(await desktop.locator('#public-nav [data-route="studio"]').evaluate((node) => node.classList.contains("is-active"))), "进入联系页后关于导航仍保持激活");
    const contactColors = await desktop.locator(".contact-mail-cta").evaluate((node) => {
      const style = getComputedStyle(node);
      return { color: style.color, background: style.backgroundColor };
    });
    assert(contactColors.color !== contactColors.background && contactColors.background !== "rgb(255, 255, 255)", "联系主按钮存在白底白字风险");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-contact-v5.png"), fullPage: true });

    await desktop.goto(`${baseUrl}#admin-login`, { waitUntil: "networkidle" });
    assert(await desktop.locator("#admin-login-shell").isVisible(), "独立后台登录页未显示");
    assert(await desktop.locator("#admin-shell").isHidden(), "未登录时后台管理内容发生泄露");
    assert(await desktop.locator("#public-shell").isHidden(), "后台登录页仍混入公开站内容");
    assert(await desktop.locator("[data-password-help]").isHidden(), "登录页错误地同时显示找回密码表单");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-login-v5.png"), fullPage: false });
    await desktop.locator("[data-open-password-help]").click();
    assert(await desktop.locator("[data-password-help]").isVisible(), "找回密码入口没有打开独立表单");
    assert(await desktop.locator("[data-login-card]").isHidden(), "找回密码时登录表单没有隐藏");
    await desktop.locator("[data-close-password-help]").click();
    await desktop.locator("[data-admin-login-form] .login-submit").click();
    assert(await desktop.locator("[data-login-error]").isVisible(), "空登录表单没有给出明确提示");
    await desktop.locator('[name="identity"]').fill("jingchen");
    await desktop.locator('[name="password"]').fill("prototype");
    await desktop.locator("[data-admin-login-form] .login-submit").click();
    assert(await desktop.locator("#admin-shell").isVisible(), "登录后后台原型未显示");
    assert(await desktop.locator("#admin-login-shell").isHidden(), "登录后登录页没有关闭");

    await desktop.locator('[data-edit-work="mint"]').click();
    assert(await desktop.locator("#edit-dialog").evaluate((dialog) => dialog.open), "编辑作品没有进入独立快速编辑");
    assert(!(await desktop.locator("#wizard-dialog").evaluate((dialog) => dialog.open)), "编辑作品错误地打开了新建向导");
    await desktop.locator('[data-edit-tab="images"]').click();
    assert(await desktop.locator('[data-edit-panel="images"].is-active').isVisible(), "编辑作品的图片管理未激活");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-edit-v5.png"), fullPage: false });
    await desktop.locator("#edit-dialog .dialog-close").click();

    await desktop.locator("[data-open-wizard]").click();
    assert(await desktop.locator("#wizard-dialog").evaluate((dialog) => dialog.open), "新建作品向导未打开");
    await desktop.locator("[data-wizard-next]").click();
    await desktop.locator("[data-simulate-upload]").click();
    await desktop.locator("[data-wizard-next]").click();
    assert(await desktop.locator('[data-wizard-step="3"].is-active').isVisible(), "未进入裁切步骤");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-new-v5.png"), fullPage: false });
    await desktop.locator("[data-wizard-next]").click();
    await desktop.locator("[data-publish-check]").check();
    await desktop.locator("[data-wizard-next]").click();
    assert(!(await desktop.locator("#wizard-dialog").evaluate((dialog) => dialog.open)), "保存草稿后上传向导未关闭");

    await desktop.locator('[data-admin-route="returns"]').click();
    assert(await desktop.locator('[data-admin-view="returns"].is-active').isVisible(), "返图管理入口未激活");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-returns-v5.png"), fullPage: false });
    await desktop.locator("[data-open-return-upload]").first().click();
    assert(await desktop.locator("#return-upload-dialog").evaluate((dialog) => dialog.open), "专用返图上传流程未打开");
    assert(await desktop.locator("[data-return-authorized]").count() === 0, "返图上传错误加入了 SPEC 明确排除的授权勾选");
    await desktop.locator("[data-return-work]").selectOption({ label: "青团 · 狼 · 半装" });
    await desktop.locator("[data-simulate-return]").click();
    await desktop.locator("[data-return-publication]").selectOption("已发布");
    await desktop.locator("[data-save-return]").click();
    assert(!(await desktop.locator("#return-upload-dialog").evaluate((dialog) => dialog.open)), "返图保存草稿后流程未关闭");

    await desktop.locator('[data-admin-route="export"]').click();
    assert(await desktop.getByRole("heading", { name: "把工作室数据带走。" }).isVisible(), "完整导出中心未显示");
    assert(await desktop.locator(".export-scope article").count() === 3, "完整导出中心缺少业务数据、图片清单或原图下载");
    assert(await desktop.locator(".archive-operations").isVisible(), "完整导出中心缺少永久原图档案的检索与重新关联入口");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-export-v5.png"), fullPage: false });

    await desktop.locator('[data-admin-route="content"]').click();
    assert(await desktop.getByRole("heading", { name: "维护不属于单件作品的站点内容。" }).isVisible(), "后台首页与页面入口仍未解释职责边界");
    assert(await desktop.locator('[data-admin-view="content"] .content-list button').count() === 5, "后台首页与页面缺少规划内容分组");
    assert(await desktop.getByText("自设委托说明与 FAQ", { exact: true }).isVisible(), "后台页面内容缺少自设委托 FAQ 管理入口");
    await desktop.screenshot({ path: path.join(screenshotDir, "desktop-admin-pages-v5.png"), fullPage: false });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await attachDiagnostics(mobile, errors);
    await mobile.goto(baseUrl, { waitUntil: "networkidle" });
    assert(await mobile.locator(".menu-toggle").isVisible(), "移动端菜单按钮不可见");
    const mobileHeroHeight = await mobile.locator(".hero-cinematic").evaluate((node) => node.getBoundingClientRect().height);
    assert(mobileHeroHeight >= 834, "移动端首页首屏没有铺满可用视口");
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端首页存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-home-v5.png"), fullPage: false });

    await mobile.locator(".business-bridge").scrollIntoViewIfNeeded();
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端业务分流存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-home-paths-v5.png"), fullPage: false });

    await mobile.locator(".menu-toggle").click();
    assert(await mobile.locator("#public-nav.is-open").isVisible(), "移动端导航未展开");
    await mobile.locator('#public-nav [data-route="works"]').click();
    assert(await mobile.locator('[data-view="works"].is-active').isVisible(), "移动端作品展示页未激活");
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端作品筛选或等大网格存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-works-v5.png"), fullPage: false });

    await mobile.locator(".menu-toggle").click();
    await mobile.locator('#public-nav [data-route="returns"]').click();
    assert(await mobile.locator('[data-view="returns"].is-active').isVisible(), "移动端返图页未激活");
    await mobile.locator('[data-view="returns"] .returns-masonry-skeleton').scrollIntoViewIfNeeded();
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端返图页存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-returns-v5.png"), fullPage: false });

    await mobile.goto(`${baseUrl}#admin-login`, { waitUntil: "networkidle" });
    assert(await mobile.locator("#admin-login-shell").isVisible(), "移动端独立后台登录页未显示");
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端后台登录页存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-admin-login-v5.png"), fullPage: false });
    await mobile.locator('[name="identity"]').fill("jingchen");
    await mobile.locator('[name="password"]').fill("prototype");
    await mobile.locator("[data-admin-login-form] .login-submit").click();
    assert(await mobile.locator(".admin-sidebar").isVisible(), "移动端后台底部导航不可见");
    assert(await mobile.locator(".admin-sidebar nav button").count() === 5, "移动端后台没有完整显示 5 个一级入口");
    await mobile.locator('[data-admin-route="returns"]').click();
    assert((await mobile.locator("body").evaluate((node) => node.scrollWidth)) <= 392, "移动端返图管理存在横向溢出");
    await mobile.screenshot({ path: path.join(screenshotDir, "mobile-admin-returns-v5.png"), fullPage: false });

    if (errors.length) {
      throw new Error(`浏览器控制台存在错误：\n${errors.join("\n")}`);
    }

    console.log(JSON.stringify({
      result: "PASS",
      desktop: ["full-viewport-image-hero", "image-first-order", "production-copy-guard", "image-business-paths", "works-carousel", "works-filters", "equal-grid", "works-detail", "adoption-detail", "commission-image-and-faq", "returns-empty-state", "about-and-terms", "contact-contrast", "admin-login", "admin-edit", "admin-new", "admin-returns", "admin-export", "admin-page-content"],
      mobile: ["full-viewport-image-hero", "image-business-paths", "navigation", "works-filters", "returns-empty-state", "admin-login", "admin-returns"],
      screenshots: fs.readdirSync(screenshotDir).sort(),
      consoleErrors: 0,
    }, null, 2));
  } finally {
    await browser.close();
    if (localServer) await new Promise((resolve) => localServer.server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
