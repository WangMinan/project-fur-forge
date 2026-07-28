const workItems = [
  {
    id: "mint",
    name: "青团",
    species: "狼",
    suit: "半装",
    purpose: "display",
    purposeLabel: "展示作品",
    year: "2026",
    image: "assets/work-mint.svg",
    description: "薄荷绿、深松石与奶油白组成的轻快角色。出厂照在真实项目中会替换这张规划占位插画。",
    facts: [["角色主人", "不公开"], ["图片来源", "出厂照"], ["完成时间", "2026 年"]],
  },
  {
    id: "coral",
    name: "赤陶",
    species: "狐",
    suit: "全装",
    purpose: "commission",
    purposeLabel: "委托作品",
    year: "2026",
    image: "assets/work-coral.svg",
    description: "柔和珊瑚色与雾蓝形成明确的角色辨识度，详情保留角色与装型等最小事实。",
    facts: [["角色主人", "阿橘"], ["图片来源", "出厂照"], ["完成时间", "2026 年"]],
  },
  {
    id: "night",
    name: "夜航",
    species: "犬",
    suit: "半装",
    purpose: "adoption",
    purposeLabel: "领养作品",
    year: "2025",
    image: "assets/work-night.svg",
    description: "雾蓝与暖黄色的夜间角色，用于检验不同色调作品在明亮站点中的层次和可读性。",
    facts: [["角色主人", "不公开"], ["图片来源", "出厂照"], ["完成时间", "2025 年"]],
  },
  {
    id: "paper",
    name: "灰烬",
    species: "龙",
    suit: "全装",
    purpose: "adoption",
    purposeLabel: "领养作品",
    year: "进行中",
    image: "assets/design-sheet.svg",
    description: "领养作品使用带工作室水印的设定图作为主图；完成后的出厂照仍归入同一件作品。",
    facts: [["业务类型", "常规领养"], ["当前状态", "可领养"], ["公开素材", "水印设定图"]],
  },
  {
    id: "cloud",
    name: "云岬",
    species: "猫",
    suit: "半装",
    purpose: "commission",
    purposeLabel: "委托作品",
    year: "2025",
    image: "assets/work-mint.svg",
    description: "柔和鼠尾草绿的猫科角色，用来验证精选作品超过五件时的横向浏览行为。",
    facts: [["角色主人", "不公开"], ["图片来源", "出厂照"], ["完成时间", "2025 年"]],
  },
  {
    id: "berry",
    name: "莓雨",
    species: "兔",
    suit: "全装",
    purpose: "display",
    purposeLabel: "展示作品",
    year: "2024",
    image: "assets/work-coral.svg",
    description: "带少量灰粉色的兔子角色，在原型中承担第六件作品与轮播越界检验。",
    facts: [["角色主人", "不公开"], ["图片来源", "出厂照"], ["完成时间", "2024 年"]],
  },
];

const adoptionItems = [
  {
    id: "ash",
    name: "灰烬 / ASH",
    description: "一只夜色与珊瑚色交错的龙。设定、后续头部与完整成品始终沿用同一条作品记录。",
    image: "assets/design-sheet.svg",
    status: "可领养",
    statusClass: "status-open",
    mode: "常规领养",
    facts: [["领养方式", "常规领养"], ["当前状态", "可领养"], ["装型", "全装"], ["后续动作", "邮件沟通"]],
  },
  {
    id: "voyage",
    name: "夜航 / VOYAGE",
    description: "计划在杭州某展会现场掉落的角色。网站只展示展会名称和当前状态，不承载现场交易。",
    image: "assets/work-night.svg",
    status: "展会出售中",
    statusClass: "status-event",
    mode: "展会掉落",
    facts: [["领养方式", "展会掉落"], ["当前状态", "展会出售中"], ["所属展会", "示例展会名称"], ["后续动作", "展会现场"]],
  },
];

const publicShell = document.querySelector("#public-shell");
const adminLoginShell = document.querySelector("#admin-login-shell");
const adminShell = document.querySelector("#admin-shell");
const publicViews = [...document.querySelectorAll("[data-view]")];
const routeLinks = [...document.querySelectorAll("[data-route]")];
const menu = document.querySelector("#public-nav");
const menuToggle = document.querySelector(".menu-toggle");
const toast = document.querySelector("[data-toast]");
const publicRoutes = new Set(["home", "works", "commission", "adoptions", "returns", "studio", "contact"]);
const publicRouteAliases = { terms: "studio" };
let toastTimer;
let prototypeAuthenticated = false;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function activatePublicRoute(route, updateHash = true) {
  const requestedRoute = route;
  const aliasedRoute = publicRouteAliases[requestedRoute] || requestedRoute;
  const safeRoute = publicRoutes.has(aliasedRoute) ? aliasedRoute : "home";
  publicViews.forEach((view) => view.classList.toggle("is-active", view.dataset.view === safeRoute));
  routeLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.route === safeRoute));
  document.body.classList.toggle("home-route", safeRoute === "home");
  menu.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  if (updateHash && location.hash !== `#${safeRoute}`) {
    history.pushState(null, "", `#${safeRoute}`);
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  document.title = `${routeTitle(safeRoute)} · 景宸的兽装工作室 · PLAN 原型 v5`;
  if (requestedRoute === "terms") {
    requestAnimationFrame(() => document.querySelector("#terms")?.scrollIntoView({ block: "start" }));
  }
}

function routeTitle(route) {
  return {
    home: "首页",
    works: "作品展示",
    commission: "自设委托",
    adoptions: "角色领养",
    returns: "返图墙",
    studio: "关于我们",
    contact: "联系",
  }[route];
}

routeLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    activatePublicRoute(link.dataset.route);
  });
});

menuToggle.addEventListener("click", () => {
  const open = menu.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

function renderFacts(target, facts) {
  target.innerHTML = facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
}

function workCardTemplate(work, index) {
  return `
    <button class="work-card" type="button" data-work-id="${work.id}" aria-label="查看作品：${work.name}">
      <span class="work-image">
        <span class="work-index">0${index + 1}</span>
        <span class="work-count">图集 0${Math.min(index + 3, 5)}</span>
        <img src="${work.image}" alt="${work.name}的原创规划占位插画">
      </span>
      <span class="work-card-info"><strong>${work.name}</strong><span>${work.purposeLabel}<br>${work.species} · ${work.suit}</span></span>
    </button>
  `;
}

const featuredWorkGrid = document.querySelector('[data-work-grid="featured"]');
const allWorkGrid = document.querySelector('[data-work-grid="all"]');
const workResultCount = document.querySelector("[data-work-result-count]");
const workFilters = { purpose: "all", suit: "all" };

featuredWorkGrid.innerHTML = workItems.map(workCardTemplate).join("");

function renderAllWorks() {
  const filteredWorks = workItems.filter((work) => {
    const purposeMatches = workFilters.purpose === "all" || work.purpose === workFilters.purpose;
    const suitMatches = workFilters.suit === "all" || work.suit === workFilters.suit;
    return purposeMatches && suitMatches;
  });
  allWorkGrid.innerHTML = filteredWorks.map((work) => workCardTemplate(work, workItems.indexOf(work))).join("");
  workResultCount.textContent = `${filteredWorks.length} 件作品`;
}

document.querySelectorAll("[data-filter-purpose]").forEach((button) => {
  button.addEventListener("click", () => {
    workFilters.purpose = button.dataset.filterPurpose;
    document.querySelectorAll("[data-filter-purpose]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderAllWorks();
  });
});

document.querySelectorAll("[data-filter-suit]").forEach((button) => {
  button.addEventListener("click", () => {
    workFilters.suit = button.dataset.filterSuit;
    document.querySelectorAll("[data-filter-suit]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderAllWorks();
  });
});

renderAllWorks();

const carouselViewport = document.querySelector("[data-carousel-viewport]");
document.querySelector("[data-carousel-prev]").addEventListener("click", () => {
  const card = carouselViewport.querySelector(".work-card");
  carouselViewport.scrollBy({ left: -(card.offsetWidth + 18), behavior: "smooth" });
});
document.querySelector("[data-carousel-next]").addEventListener("click", () => {
  const card = carouselViewport.querySelector(".work-card");
  carouselViewport.scrollBy({ left: card.offsetWidth + 18, behavior: "smooth" });
});

const workDialog = document.querySelector("#work-dialog");
let activeWorkIndex = 0;

function openWork(workId) {
  activeWorkIndex = workItems.findIndex((work) => work.id === workId);
  if (activeWorkIndex < 0) activeWorkIndex = 0;
  const work = workItems[activeWorkIndex];
  workDialog.querySelector("[data-detail-image]").src = work.image;
  workDialog.querySelector("[data-detail-image]").alt = `${work.name}的原创规划占位插画`;
  workDialog.querySelector("[data-detail-name]").textContent = work.name;
  workDialog.querySelector("[data-detail-meta]").textContent = `${work.species} · ${work.suit} · ${work.year}`;
  workDialog.querySelector("[data-detail-description]").textContent = work.description;
  renderFacts(workDialog.querySelector("[data-detail-facts]"), work.facts);
  const companions = [work, workItems[(activeWorkIndex + 1) % workItems.length], workItems[(activeWorkIndex + 2) % workItems.length]];
  workDialog.querySelector("[data-detail-thumbs]").innerHTML = companions.map((item, index) => `
    <button type="button" class="${index === 0 ? "is-active" : ""}" data-thumb-image="${item.image}" data-thumb-name="${item.name}">
      <img src="${item.image}" alt="${item.name}缩略图">
    </button>
  `).join("");
  if (!workDialog.open) workDialog.showModal();
}

document.addEventListener("click", (event) => {
  const workButton = event.target.closest("[data-work-id]");
  if (workButton) openWork(workButton.dataset.workId);

  const thumb = event.target.closest("[data-thumb-image]");
  if (thumb) {
    workDialog.querySelector("[data-detail-image]").src = thumb.dataset.thumbImage;
    workDialog.querySelector("[data-detail-image]").alt = `${thumb.dataset.thumbName}的规划占位插画`;
    workDialog.querySelectorAll("[data-thumb-image]").forEach((button) => button.classList.toggle("is-active", button === thumb));
  }

  const close = event.target.closest(".dialog-close");
  if (close) close.closest("dialog").close();
});

workDialog.querySelector("[data-dialog-next]").addEventListener("click", () => {
  activeWorkIndex = (activeWorkIndex + 1) % workItems.length;
  openWork(workItems[activeWorkIndex].id);
});

const adoptionGrid = document.querySelector("[data-adoption-grid]");
adoptionGrid.innerHTML = adoptionItems.map((item) => `
  <button class="adoption-card" type="button" data-adoption-id="${item.id}" aria-label="查看领养角色：${item.name}">
    <img src="${item.image}" alt="${item.name}的原创规划占位插画">
    <span class="adoption-card-copy">
      <span class="status-tag ${item.statusClass}">${item.status}</span>
      <h2>${item.name}</h2>
      <p>${item.mode} · 不公开价格</p>
      <b>查看角色与规则 →</b>
    </span>
  </button>
`).join("");

const adoptionDialog = document.querySelector("#adoption-dialog");

function openAdoption(adoptionId) {
  const item = adoptionItems.find((adoption) => adoption.id === adoptionId) || adoptionItems[0];
  const image = adoptionDialog.querySelector(".adoption-dialog-image img");
  image.src = item.image;
  image.alt = `${item.name}的原创规划占位插画`;
  const status = adoptionDialog.querySelector("[data-adoption-status]");
  status.textContent = item.status;
  status.className = `status-tag ${item.statusClass}`;
  adoptionDialog.querySelector("[data-adoption-name]").textContent = item.name;
  adoptionDialog.querySelector("[data-adoption-description]").textContent = item.description;
  renderFacts(adoptionDialog.querySelector("[data-adoption-facts]"), item.facts);
  if (!adoptionDialog.open) adoptionDialog.showModal();
}

document.querySelectorAll("[data-adoption-id]").forEach((button) => {
  button.addEventListener("click", () => openAdoption(button.dataset.adoptionId));
});

document.querySelector("[data-copy-email]").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("3114559925@qq.com");
    showToast("邮箱已复制：3114559925@qq.com");
  } catch {
    showToast("请手动复制：3114559925@qq.com");
  }
});

function setShellState(shell) {
  publicShell.hidden = shell !== "public";
  adminLoginShell.hidden = shell !== "login";
  adminShell.hidden = shell !== "admin";
  document.body.classList.toggle("admin-mode", shell === "admin");
  document.body.classList.toggle("admin-login-mode", shell === "login");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showPublic(route = "home", updateHash = true) {
  setShellState("public");
  activatePublicRoute(route, updateHash);
}

function showAdminLogin(updateHash = true) {
  setShellState("login");
  document.querySelector("[data-login-error]").hidden = true;
  document.querySelector("[data-password-help]").hidden = true;
  document.querySelector("[data-login-card]").hidden = false;
  document.body.classList.remove("home-route");
  document.title = "后台登录 · 景宸的兽装工作室 · PLAN 原型 v5";
  if (updateHash && location.hash !== "#admin-login") {
    history.pushState(null, "", "#admin-login");
  }
}

function showAdmin(updateHash = true) {
  setShellState("admin");
  activateAdminRoute("works");
  document.body.classList.remove("home-route");
  document.title = "工作室后台 · 景宸的兽装工作室 · PLAN 原型 v5";
  if (updateHash && location.hash !== "#admin") {
    history.pushState(null, "", "#admin");
  }
}

function handleLocation() {
  const route = location.hash.slice(1) || "home";
  if (route === "admin-login") {
    showAdminLogin(false);
    return;
  }
  if (route === "admin") {
    if (prototypeAuthenticated) {
      showAdmin(false);
    } else {
      showAdminLogin(true);
    }
    return;
  }
  showPublic(route, false);
}

window.addEventListener("hashchange", handleLocation);

document.querySelector("[data-admin-login-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const identity = String(form.get("identity") || "").trim();
  const password = String(form.get("password") || "").trim();
  const error = document.querySelector("[data-login-error]");
  if (!identity || !password) {
    error.hidden = false;
    return;
  }
  error.hidden = true;
  prototypeAuthenticated = true;
  showAdmin();
});

document.querySelector("[data-open-password-help]").addEventListener("click", () => {
  document.querySelector("[data-login-card]").hidden = true;
  document.querySelector("[data-password-help]").hidden = false;
});

document.querySelector("[data-close-password-help]").addEventListener("click", () => {
  document.querySelector("[data-password-help]").hidden = true;
  document.querySelector("[data-login-card]").hidden = false;
});

document.querySelector("[data-send-reset]").addEventListener("click", () => {
  const email = document.querySelector("[data-reset-email]").value.trim();
  if (!email) {
    showToast("请先填写管理员邮箱。");
    return;
  }
  showToast("原型模拟：找回邮件已发送，链接 30 分钟内有效。");
  document.querySelector("[data-password-help]").hidden = true;
  document.querySelector("[data-login-card]").hidden = false;
});

document.querySelectorAll("[data-admin-public]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPublic("home");
  });
});

document.querySelector("[data-preview-public]").addEventListener("click", () => {
  showPublic("works");
  showToast("这是管理员发布前看到的公开站预览。");
});

const adminRouteButtons = [...document.querySelectorAll("[data-admin-route]")];
const adminViews = [...document.querySelectorAll("[data-admin-view]")];

function activateAdminRoute(route) {
  adminRouteButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.adminRoute === route));
  adminViews.forEach((view) => view.classList.toggle("is-active", view.dataset.adminView === route));
  window.scrollTo({ top: 0, behavior: "instant" });
}

adminRouteButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateAdminRoute(button.dataset.adminRoute);
  });
});

document.querySelectorAll(".segmented, .media-tabs, .admin-toolbar div").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    group.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

document.querySelectorAll(".status-editor-grid article > button").forEach((button) => {
  button.addEventListener("click", () => showToast("营业状态已在原型中模拟发布。公开站刷新后应读取新状态。"));
});

const wizardDialog = document.querySelector("#wizard-dialog");
const wizardPanels = [...document.querySelectorAll("[data-wizard-step]")];
const wizardIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const wizardBack = document.querySelector("[data-wizard-back]");
const wizardNext = document.querySelector("[data-wizard-next]");
const uploadQueue = document.querySelector("[data-upload-queue]");
const fileInput = document.querySelector("[data-file-input]");
let wizardStep = 1;
let hasUpload = false;

function setWizardStep(step) {
  wizardStep = Math.min(4, Math.max(1, step));
  wizardPanels.forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.wizardStep) === wizardStep));
  wizardIndicators.forEach((indicator) => indicator.classList.toggle("is-active", Number(indicator.dataset.stepIndicator) === wizardStep));
  wizardBack.disabled = wizardStep === 1;
  wizardNext.textContent = wizardStep === 4 ? "保存为草稿" : "继续";
  const workName = document.querySelector("[data-work-name]").value.trim() || "未命名作品";
  document.querySelector("[data-preview-name]").textContent = workName;
}

function openWizard() {
  wizardStep = 1;
  hasUpload = false;
  uploadQueue.hidden = true;
  uploadQueue.innerHTML = "";
  fileInput.value = "";
  document.querySelector("[data-publish-check]").checked = false;
  setWizardStep(1);
  wizardDialog.showModal();
}

document.querySelector("[data-open-wizard]").addEventListener("click", openWizard);
const editDialog = document.querySelector("#edit-dialog");
const editTitles = {
  mint: "青团",
  ash: "灰烬",
  coral: "赤陶",
  night: "夜航",
  cloud: "云岬",
  berry: "莓雨",
};

document.querySelectorAll("[data-edit-work]").forEach((button) => {
  button.addEventListener("click", () => {
    editDialog.querySelector("[data-edit-title]").textContent = editTitles[button.dataset.editWork] || "编辑作品";
    editDialog.querySelectorAll("[data-edit-tab]").forEach((tab, index) => tab.classList.toggle("is-active", index === 0));
    editDialog.querySelectorAll("[data-edit-panel]").forEach((panel, index) => panel.classList.toggle("is-active", index === 0));
    editDialog.showModal();
  });
});

editDialog.querySelectorAll("[data-edit-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    editDialog.querySelectorAll("[data-edit-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
    editDialog.querySelectorAll("[data-edit-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.editPanel === tab.dataset.editTab));
  });
});

document.querySelector("[data-save-edit]").addEventListener("click", () => {
  editDialog.close();
  showToast("原型模拟：作品状态已直接保存，没有经过新建门禁。");
});

document.querySelector("[data-jump-returns]").addEventListener("click", () => {
  editDialog.close();
  activateAdminRoute("returns");
  showToast("已进入返图管理；返图不会混入作品的新建流程。");
});

wizardIndicators.forEach((indicator) => {
  indicator.addEventListener("click", () => {
    const target = Number(indicator.dataset.stepIndicator);
    if (target > 2 && !hasUpload) {
      showToast("请先在第 2 步模拟或选择一张图片。");
      setWizardStep(2);
      return;
    }
    setWizardStep(target);
  });
});

wizardBack.addEventListener("click", () => setWizardStep(wizardStep - 1));
wizardNext.addEventListener("click", () => {
  if (wizardStep === 2 && !hasUpload) {
    showToast("请先选择图片，或使用示例图模拟上传。");
    return;
  }
  if (wizardStep === 4) {
    if (!document.querySelector("[data-publish-check]").checked) {
      showToast("发布前请确认已经检查公开信息。");
      return;
    }
    wizardDialog.close();
    showToast("原型模拟完成：作品已保存为草稿，没有上传到 OSS。");
    return;
  }
  setWizardStep(wizardStep + 1);
});

function renderUploadPreview(source, fileName) {
  hasUpload = true;
  uploadQueue.hidden = false;
  uploadQueue.innerHTML = `
    <div class="upload-item">
      <img src="${source}" alt="待上传图片预览">
      <span><strong>${fileName}</strong><i class="upload-progress"><i></i></i></span>
      <b>READY</b>
    </div>
  `;
}

document.querySelector("[data-simulate-upload]").addEventListener("click", () => {
  renderUploadPreview("assets/work-coral.svg", "示例出厂照-01.webp");
  showToast("已模拟：原图上传、衍生图处理与访问校验完成。");
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    fileInput.value = "";
    showToast("只接受 JPG、PNG 或 WebP。");
    return;
  }
  if (file.size > 20_000_000) {
    fileInput.value = "";
    showToast("图片超过 20 MB，原型按 SPEC 拒绝。");
    return;
  }
  renderUploadPreview(URL.createObjectURL(file), file.name);
});

document.querySelector("[data-work-name]").addEventListener("input", (event) => {
  document.querySelector("[data-preview-name]").textContent = event.target.value.trim() || "未命名作品";
});

const returnUploadDialog = document.querySelector("#return-upload-dialog");
const returnFileInput = document.querySelector("[data-return-file]");
let returnHasFiles = false;

document.querySelectorAll("[data-open-return-upload]").forEach((button) => {
  button.addEventListener("click", () => {
    returnHasFiles = false;
    returnFileInput.value = "";
    document.querySelector("[data-return-work]").value = "";
    document.querySelector("[data-return-publication]").value = "草稿";
    document.querySelector("[data-simulate-return]").textContent = "使用骨架卡片模拟 3 张返图";
    returnUploadDialog.showModal();
  });
});

document.querySelector("[data-simulate-return]").addEventListener("click", (event) => {
  returnHasFiles = true;
  event.currentTarget.textContent = "已模拟 3 张返图 · READY";
  showToast("已模拟 3 张返图的批量上传、处理与排序队列。");
});

returnFileInput.addEventListener("change", () => {
  const files = [...returnFileInput.files];
  if (!files.length) return;
  if (files.length > 5) {
    returnFileInput.value = "";
    showToast("单件作品最多 5 张返图，原型按 SPEC 拒绝。");
    return;
  }
  const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20_000_000);
  if (invalid) {
    returnFileInput.value = "";
    showToast("返图只接受 JPG、PNG、WebP，且单张不超过 20 MB。");
    return;
  }
  returnHasFiles = true;
  document.querySelector("[data-simulate-return]").textContent = `已选择 ${files.length} 张返图 · READY`;
});

document.querySelector("[data-save-return]").addEventListener("click", () => {
  if (!document.querySelector("[data-return-work]").value) {
    showToast("请先把返图关联到一件已有作品。");
    return;
  }
  if (!returnHasFiles) {
    showToast("请先选择返图，或使用骨架卡片模拟上传。");
    return;
  }
  const publication = document.querySelector("[data-return-publication]").value;
  returnUploadDialog.close();
  showToast(`原型模拟：返图已关联作品并保存为${publication}。`);
});

document.querySelectorAll("[data-export-action]").forEach((button) => {
  button.addEventListener("click", () => showToast(`原型模拟：已创建“${button.dataset.exportAction}”任务。`));
});

[workDialog, adoptionDialog, wizardDialog, editDialog, returnUploadDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

handleLocation();
