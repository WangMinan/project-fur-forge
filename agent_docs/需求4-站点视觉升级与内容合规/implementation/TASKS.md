# 任务清单：站点视觉升级与内容合规

> **角色**：需求4唯一任务与勾选权威；每个任务均可由 Agent 独立实现、验证和交接。
> **状态**：文档阶段已完成；应用实现尚未开始。
> **规则**：完成即勾选；不删除历史项；实现、独立 Review、用户验收和生产发布互不代签。

## 当前目标

先修正真实信息收集、确认、保存和删除边界，再以低维护成本完成首页四幕、统一动效、Hero 九宫格焦点和第三方声明；不得新增自动清理调度、在线合同、required check 或复杂裁切器。

## 0. 文档与基线

- [x] **T00 · 需求4文档地基**：按 `_template` 完成 foundation、SPEC、COPY、design、models、PLAN、DATA-MIGRATION、TASKS、notes、review、artifacts 和 STATE。
- [x] **T01 · 代码/历史基线复核**：对照 `main@913d257` 的首页聚合、Hero、焦点字段、站点展示配方、委托 Schema、默认文案与 licenses 页面。
- [x] **T02 · 外部设计资料复核**：评估 Apple、渔屋、万物通行和 Apple Design Skill；只采纳可解释原则，不复制品牌或把动效库当默认依赖。
- [x] **T03 · 文档交叉 Review**：统一 DITE DOG、QQ 优先、邮箱备用、四幕、移动端、人工清理、QQ 逐单确认、字体/FFmpeg和 Git 规则。

### GATE-0 · 文档可实施

- [x] SPEC/PLAN 无未答 OQ；
- [x] 需求4目录遵循 `_template`；
- [x] 与需求1～3未覆盖基线无冲突；
- [x] 未将视觉升级写成恢复退役业务；
- [x] 未虚构经营主体、授权证照、生产清理或法律结论。

## A. 内容、隐私与申请确认

- [ ] **T04 · 经营主体字段 expand**：新增 `privacy_controller_name`、Schema/DTO/repository/service/管理配置和分区版本；迁移默认 NULL。
- [ ] **T05 · 申请确认字段 expand**：新增 intake contract、成年、政策版本、申请告知版本和确认时间；legacy 行保持 NULL。
- [ ] **T06 · Expand/contract 迁移验证**：expand 支持 legacy/v2；新代码显式写 v2；contract 默认收口为 2；fresh/当前既有库副本/重入/FK/integrity 均通过。
- [ ] **T07 · Intake metadata 投影**：公开返回最低年龄、处理者、隐私/告知版本和页面链接；配置缺失时稳定不可用。
- [ ] **T08 · 申请页即时告知**：加入三个未预勾选确认、政策链接、QQ 优先和非接单说明；键盘/屏幕阅读器可用。
- [ ] **T09 · 提交版本校验**：API 要求 literal true 和当前版本；stale 返回稳定 409，不消费 upload、不清空页面。
- [ ] **T10 · Legacy/v2 管理展示**：详情只读显示确认摘要；历史申请明确标记 legacy，不推断年龄。
- [ ] **T11 · 默认文案前向迁移**：按 `COPY.md` 只替换 NULL/空值/精确历史默认；正确递增 section version。
- [ ] **T12 · 隐私与条款页面**：结构化显示处理者、邮箱、版本、更新时间；无占位泄漏。
- [ ] **T13 · 内容人工 Review**：列出未自动覆盖的管理员文案，由工作室确认，不在日志输出全文/PII。
- [ ] **T14 · 申请隐私门禁**：PII leakage、错误、日志、analytics、URL、sessionStorage/localStorage、SSR HTML 负向测试。

### GATE-A · 新申请真实、可告知

- [ ] 真实经营主体名称与邮箱可配置但未被假默认填充；
- [ ] 新申请只能显式写 v2，contract 后缺确认字段或 v1 默认插入均失败；
- [ ] legacy 申请保持可读可处理；
- [ ] 隐私政策描述实际表单、体型和私有设定图；
- [ ] 提交不等于接单，官方 QQ 私聊是后续优先渠道；
- [ ] 未成年人不能提交，系统不额外收集身份证件。

## B. 人工保留、精确删除与第三方声明

- [ ] **T15 · 保留复核 CLI**：提供失效上传、pending 总览、rejected cutoff 和显式 accepted/请求删除候选；默认掩码/dry-run。
- [ ] **T16 · 删除关系盘点**：按 submission 枚举 session、asset、PRIVATE variants、preview、pending、versions/delete marker；异常外部引用阻断。
- [ ] **T17 · 单条精确删除**：强确认、对象验证、事务删行、最小审计、幂等重入；不碰作品/其它申请。
- [ ] **T18 · 受限批量删除**：只允许 `rejected + before`，逐条串行；pending/accepted 不允许时间批删。
- [ ] **T19 · 删除测试与隔离演练**：current/version/delete marker、部分 NotFound、OSS 失败、DB 失败、重入和外部引用负向用例。
- [ ] **T20 · 人工 SOP**：形成月度未消费上传、半年度申请复核、用户请求和灾备恢复后复核步骤；不建设 scheduler。
- [ ] **T21 · 生产许可证事实生成**：从 pnpm 生产依赖确定性生成 JSON/TXT，稳定排序、无时间噪声。
- [ ] **T22 · 第三方资产 registry**：登记 FFmpeg、Noto Serif SC、ZhuoHei Collage 的实际版本/来源/用途/授权分类和内部证据要求。
- [ ] **T23 · `/licenses` 改造**：页面从生成清单读取；纠正“均为 MIT/Apache”；提供完整声明入口。
- [ ] **T24 · 声明 drift/边界测试**：lockfile、人工 registry、页面和文件一致；FFmpeg 明确服务器内部使用；无新增 required check。

### GATE-B · 数据可人工退出、声明可核对

- [ ] 删除 CLI 默认无副作用，正式执行必须强确认；
- [ ] 一次删除覆盖 DB 和私有 OSS，不产生可恢复 PII manifest；
- [ ] accepted 不按时间批量猜测；
- [ ] 月度/半年度流程可以由操作员手工执行；
- [ ] `/licenses` 与实际生产依赖及静态资产一致；
- [ ] 免费商用字体不被误称开源，FFmpeg不被误称对外分发。

## C. 设计系统、导航与 Hero 焦点

- [ ] **T25 · 真实素材基线**：用当前生产风格大图记录 1440/1024/768/430/390 首页、Header、Footer 和 LCP/CLS 基线。
- [ ] **T26 · Motion token 收敛**：统一反馈/内容/媒体/page duration、easing、distance；移除 620/680/750ms 平行常量。
- [ ] **T27 · 公开行动组件**：凝练 primary/secondary/text，替换重复胶囊样式，保持功能和无障碍。
- [ ] **T28 · Header/Footer 克制化**：降低导航浮起和阴影；一层材料；reduced transparency/contrast；保留备案和法务。
- [ ] **T29 · 焦点管理 API/CAS**：复用 asset focal，限制未启用 Hero；集合版本冲突稳定；不新增 crop 表。
- [ ] **T30 · 九宫格管理 UI**：目标比例预览、九预设、默认中心、历史自定义提示；不显示小数/自由裁切。
- [ ] **T31 · 焦点 publication 链**：变体 identity、preview、发布、清理、ESA 与失败恢复正确；新变体验证后才切换。
- [ ] **T32 · 焦点回归**：首页/委托×横/竖，中心/四角、共享 asset 冲突、已启用禁止和 reduced-motion 管理反馈。

### GATE-C · 设计地基稳定

- [ ] 公开动效 token 有唯一语义来源；
- [ ] Header/Footer 更克制且真实图片上可读；
- [ ] 九宫格不增加日常必填维护；
- [ ] 既有任意 focal 不被破坏；
- [ ] 焦点修改不产生混代、残留公开对象或热更新闪烁；
- [ ] 管理端未被品牌动效污染。

## D. 首页四幕与对象连续性

- [ ] **T33 · 首页聚合投影复核**：保持单聚合请求和独立降级；不增加纯版式 CMS/表。
- [ ] **T34 · 四幕语义骨架**：Hero → 代表作品 → 自设委托 → 设定领养；heading/空态/SSR正确。
- [ ] **T35 · 品牌 Hero 收口**：真实图片对比保护、控制器降权、PC冲击力、移动安全区；保持横竖/10秒/暂停。
- [ ] **T36 · Lead work**：精选第一项大图，剩余精选次级；横竖自然比例，零项隐藏，移动有“查看全部”。
- [ ] **T37 · 自设委托幕**：移除 21:9 描边卡；同源委托图、非对称分栏、一个主 CTA、状态与短文案。
- [ ] **T38 · 设定领养幕**：available 前两项、一/二/零项布局、cover→design sheet 回落、adopted 边界。
- [ ] **T39 · 区块进入与媒体交接**：统一语义、一次揭示、移动简化、无JS默认可见、无持续 rAF。
- [ ] **T40 · 共享对象渐进增强**：lead/commission/adoption 到内页；唯一 name、后退/锚点/错误回退；无 polyfill。
- [ ] **T41 · 内页节奏同步**：works/commission/adoptions 只做必要留白、动作和图像连续性，不恢复退役字段。
- [ ] **T42 · 响应式/偏好验收**：1440/1024/768/430/390、reduced motion/transparency/contrast、键盘和触控。
- [ ] **T43 · 性能验收**：LCP 优先、懒加载、CLS < 0.1、无白闪/双图/空闲动画和横向溢出。

### GATE-D · 首页品牌体验完成

- [ ] 四幕覆盖完整核心业务且视觉权重不等；
- [ ] 一个视口一个主要注意力中心；
- [ ] 代表作品能接住 Hero，不立即退化为小卡轨道；
- [ ] 委托与领养是完整章节，不是同权业务卡；
- [ ] PC Web 达到用户审美目标；
- [ ] 移动端完成同一任务，不依赖 hover/强制横轨；
- [ ] reduced-motion 与无 JS 内容完整；
- [ ] 王旻安和景宸完成真实素材人工验收。

## E. 全站收口、Review 与发布

- [ ] **T44 · SEO/README/活文档审计**：DITE DOG 固定，去除暂用名/旧渠道/旧隐私/邮件优先；同步需求4状态。
- [ ] **T45 · 完整质量门禁**：lint/typecheck/unit/integration/production build/verify/完整 E2E；不新增 required check。
- [ ] **T46 · 真实浏览器与手机**：六档视口、输入法、二维码、焦点、图片 decode、network/console、LCP/CLS。
- [ ] **T47 · 独立代码与内容 Review**：迁移、PII、删除、许可证、动效、性能、法务一致性；修复 findings 后复审。
- [ ] **T48 · 工作室验收**：真实经营主体、默认文案、条款、隐私、首页图片/焦点/节奏、移动端由用户签字确认。
- [ ] **T49 · 生产发布准备**：备份/恢复、迁移顺序、真实配置、notices、retention dry-run、回滚边界。
- [ ] **T50 · 生产发布与 smoke**：home/privacy/service/licenses/apply/admin；提交 v2/stale；媒体和私有预览。
- [ ] **T51 · 人工清理交接**：记录责任人、下次月度/半年度日期和用户删除请求入口。
- [ ] **T52 · 需求4闭环**：STATE/ARTIFACTS/REVIEW/notes/任务勾选与最终证据同步。

## 验证

- [ ] 静态：文档链接、Schema、类型、lint、文案 grep、notices drift、secret/content scan。
- [ ] 数据：fresh/既有库/重入/FK/integrity、legacy/v2、默认文案保护、删除关系与重入。
- [ ] API：intake metadata、literal true、stale 409、pending 唯一、Origin/token/TTL/限流/蜜罐。
- [ ] 媒体：九宫格、publication/lease/recovery/purge、OSS current/version/delete marker、ESA。
- [ ] UI：完整 E2E + 六档真实浏览器 + 真实手机 + reduced preferences。
- [ ] 内容：工作室读者 Review；必要时另行专业法律意见。
- [ ] 生产：备份恢复、配置、迁移、smoke、隔离删除演练和人工 SOP。

## 闭环结论

- 尚未实施；需求4文档已完成，可从 T04 开始。
