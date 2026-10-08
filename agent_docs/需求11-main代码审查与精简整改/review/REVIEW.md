# 评审记录：main代码审查与精简整改

## 评审对象

- 日期：2026-10-08；工具流程：用户指定的 ponytail-review，只读审查。
- 基准：远端 main `fe95fab6297660eac778ea85a072948e74a7bb03`。定位中的行号是该快照的行号；相对文件链接不随未来行号自动冻结。
- 范围：前后台主要调用链、认证与限流、委托删除、媒体上传/发布/恢复、DTO、公共组件、测试和运维配置。第一轮偏重正确性与安全，用户指出遗漏后，第二轮补查冗余与复用。
- F01–F12 对应聊天原意见1–12；下文各发现保留整改前证据，当前实现结果见末节。F01–F06 有隔离或本地复现；F07 为静态规则不一致；F08–F12 为调用链和重复实现检查，不能表述为已复现的运行故障。
- 负载假设遵守当前部署：一个常驻 app，加可单独运行的一次性运维进程；不以假设的大规模多实例架构为由要求重构。

## 意见总表

| 编号 | 原编号 | 分类 | 标题 | 状态 |
| --- | --- | --- | --- | --- |
| F01 | 1 | 必须修复 / P1 | 委托删除与编辑竞争可能丢失原图 | 本地已整改 |
| F02 | 2 | 必须修复 / P1 | 登录尾斜杠绕过部分安全检查 | 本地已整改 |
| F03 | 3 | 必须修复 / P2 | 快速重启后发布任务可能持续处理中 | 本地已整改 |
| F04 | 4 | 必须修复 / P2 | 停止轮询后在途响应仍可继续执行 | 本地已整改 |
| F05 | 5 | 必须修复 / P2 | 管理上传校验中断后不能恢复或清理 | 本地已整改 |
| F06 | 6 | 必须修复 / P2 | 已失效的手工排序贯穿表单与请求 | 本地已整改 |
| F07 | 7 | 必须修复 / P2 | 代表作品上限提示未复用常量且已漂移 | 本地已整改 |
| F08 | 8 | 应该精简 | 两套旧管理 DTO 只剩测试调用 | 本地已整改 |
| F09 | 9 | 应该精简 | 设定图与封面重复实现单图编辑流程 | 本地已整改 |
| F10 | 10 | 应该精简 | 公开图片完整性校验重复三份 | 本地已整改 |
| F11 | 11 | 可随后处理 | Hero 与代表作品重复维护控件显隐 | 本地已整改 |
| F12 | 12 | 可随后处理 | 上传组件保留未使用的后台主题 | 本地已整改 |

## F01 · 委托删除与后台编辑竞争，可能导致原图丢失

- **位置：**[commission-retention.ts](../../../server/utils/service/commission-retention.ts) L192–227；[commission-repository.ts](../../../server/utils/repository/commission-repository.ts) L188–205、L339起；[commission-management.ts](../../../server/utils/service/commission-management.ts) 的 `updateCommissionSubmission`。
- **作用：**删除一笔申请及其私有附件，并阻止删除过程中的冲突操作。
- **问题与触发：**删除锁保存在进程内 Set，key 是传入 identifier；后台更新按申请 ID 检查。CLI 与 app 不共享 Set，ID 和回执编号也未统一。邮件已有持久删除标记，但编辑 SQL 没有据此拒绝更新。删除对象之后才检查申请版本，已无法恢复刚删除的原图。
- **已有证据：**使用内存 SQLite、既有合成 fixture 与假对象存储，以回执编号调用删除，在首次 `deleteAll` 内插入实际 `updateCommissionSubmission(... status: accepted)` 调用。结果为 `concurrentEdit=true`、申请 `status=accepted`、`email_deletion_pending=1`、`originalStillExists=false`，随后返回 `Commission deletion failed safely.`。未访问真实 OSS。该复现展示别名锁失效；跨进程风险由同一进程内 Set 的实现和独立 CLI 调用链确认。
- **最小建议：**先统一申请 ID，在事务内按当前版本/状态取得持久删除权，再进入外部删除；所有编辑入口遵守该标记。优先复用现有字段，并覆盖盘点期间发生编辑的窗口及失败重入。
- **不处理后果：**申请还在、甚至已被接受，但设定原图已经丢失。
- **待验收：**ID/回执别名、独立进程、盘点中编辑、删除失败后重入均不能产生上述结果。

## F02 · 登录 URL 尾斜杠可绕过部分安全检查

- **位置：**[02.auth-security.ts](../../../server/middleware/02.auth-security.ts) L16–33；[login.post.ts](../../../server/api/auth/login.post.ts)；[events.post.ts](../../../server/api/public/v1/analytics/events.post.ts)。
- **作用：**登录前校验 Origin 并执行 IP 总限流，统计请求先执行 IP 总限流。
- **问题与触发：**中间件精确匹配 `/api/auth/login`，实际路由也接受 `/api/auth/login/`，后者绕过该分支。登录 handler 剩余的 IP+用户名分桶不能阻止同一 IP 轮换用户名消耗密码计算资源。统计入口存在同类精确路径比较，handler 的 IP+会话分桶不等价于 IP 总限流。
- **已有证据：**先以当前安装的 H3 路由做最小验证，再向隔离本地 Nuxt 管理 Host 发送不带 Origin、JSON body 为 `{}` 的 POST。普通登录路径返回403/FORBIDDEN，尾斜杠路径返回400/VALIDATION_ERROR，已进入参数校验。没有使用真实管理员凭据，也没有进行压力攻击。统计分支为代码路径核对，未执行绕过压测。
- **最小建议：**让安全匹配与路由采用一致的路径规范化或等价入口保护；一起检查登录、统计、登出等精确匹配位置，补尾斜杠回归。
- **不处理后果：**来源校验和 IP 总限流存在绕过路径；这不是“无需密码即可登录”的结论。
- **待验收：**等价路径的 Origin、限流和认证结果一致，轮换用户名/会话不能绕过总限流。

## F03 · 快速重启后，发布任务可能一直停在处理中

- **位置：**[02.operation-recovery.ts](../../../server/plugins/02.operation-recovery.ts) L26–38；[operation-lease.ts](../../../server/utils/repository/operation-lease.ts) L228–240；[operation-interrupt.test.ts](../../../tests/integration/operation-interrupt.test.ts) L253起。
- **作用：**启动后恢复未完成的媒体持久任务。
- **问题与触发：**恢复只在启动时扫描一次，跳过仍有效的60秒租约。旧进程退出后若在到期前重启，扫描会漏过任务，到期后没有新扫描。现有中断测试显式把租约改为过期，未覆盖这个窗口。
- **已有证据：**内存库创建旧执行者任务，调用真实 `recoverPendingOperations` 模拟第5秒启动，输出 `scanned=0/resumed=0`；第61秒真实候选查询可找到1条任务，但状态仍为 `GENERATING_PUBLIC`。时间为注入的模拟值，不是一次真实生产重启测试。
- **最小建议：**补有界后续扫描与停止清理，继续尊重有效租约；不要直接抢占所有启动时发现的任务。
- **不处理后果：**任务持续占用运行态，阻止后续操作，需人工恢复。
- **待验收：**到期前重启、活跃执行者、超过扫描上限和重复恢复均能正确收敛。

## F04 · 离开页面后，发布轮询仍可能继续执行

- **位置：**[usePublicationPolling.ts](../../../app/composables/usePublicationPolling.ts) L24–85；[useAdminHeroCollection.ts](../../../app/composables/useAdminHeroCollection.ts) L77–96；[PublicationPanel.vue](../../../app/components/admin/PublicationPanel.vue) 的 `pollOperation`。
- **作用：**轮询 operation，更新进度并在终态执行回调。
- **问题与触发：**`stop()` 只清除已安排的 timer，不能使在途请求失效。响应返回后仍调用 onTick/onSettled 或安排下一轮；请求期间没有 timer，`isPolling()` 返回 false。Hero 的终态回调中还存在适配完成后自动 enable 的业务操作。
- **已有证据：**从真实 composable 源码转译执行，以延迟 Promise 替代 API；请求发出后调用销毁回调，再返回 `GENERATING_PUBLIC`，观察到 `ticks=1/scheduled=1`，且请求期间 `isPolling=false`。未在真实管理数据上触发自动启用。
- **最小建议：**按 key 跟踪活动身份/取消状态，每次 await 后校验；活动状态覆盖请求、等待定时器和终态处理，旧轮询不能干扰新轮询。
- **不处理后果：**请求泄漏、重复轮询，甚至离开页面后继续发起后续操作。
- **待验收：**stop、卸载、同 key 替换、401、终态及延迟响应均无旧回调或新 timer 残留。

## F05 · 管理上传校验中断后，无法恢复或清理

- **位置：**[media-completion.ts](../../../server/utils/service/media-completion.ts) L379起；[upload-session.ts](../../../server/utils/service/upload-session.ts) 的 get/cancel/retry；[upload-cleanup.ts](../../../server/utils/runner/upload-cleanup.ts) L30–47。
- **作用：**核验管理上传的原图、恢复失败会话并清理失效上传。
- **问题与触发：**进程在资产创建前的 VALIDATING 阶段退出后，没有该状态的恢复入口。get 只使 AWAITING_UPLOAD 过期，cancel/retry 拒绝 VALIDATING，清理候选也排除了它。
- **已有证据：**内存库应用真实迁移，用现有合成 fixture 创建上传会话，模拟状态进入 VALIDATING 后执行者退出；注入一天后的时间，真实 get 仍返回 VALIDATING，cancel/retry 均409，清理候选为0。没有删除真实对象。
- **最小建议：**为失去执行者的校验增加可验证的恢复/失败规则，衔接现有重试与清理；不能简单把所有 VALIDATING 纳入删除。
- **不处理后果：**用户只能重传，旧会话与私有对象持续遗留。
- **待验收：**中断后可恢复，正常慢核验与已绑定资产不被误清；本发现针对管理上传，不把匿名委托上传的不同清理规则混为一谈。

## F06 · 无效的手工排序功能仍贯穿表单和请求链路

- **位置：**[WorkBasicsFields.vue](../../../app/components/admin/WorkBasicsFields.vue) L137–150；[work-form.ts](../../../app/utils/work-form.ts) 的排序解析/校验/快照；[work-management.ts](../../../server/utils/service/work-management.ts) L505起、L585；[work.ts](../../../shared/schemas/work.ts) L42–67。
- **作用：**创建/编辑作品时输入排序，并参与校验、dirty 判定和提交。
- **问题与触发：**后端创建固定 sort_order=0，更新按代表作品集合位置计算，用户传入的数值已经无效。展示设置请求也将该字段标为 deprecated，但表单仍允许编辑。
- **已有证据：**内存库调用实际 create/update：创建传17、更新传99，返回的 sortOrder 均为0。
- **最小建议：**删除无效输入及表单处理，沿用现有代表作品列表排序入口；核对写入请求兼容，保留真实读取顺序和集合排序字段。
- **不处理后果：**用户以为排序已保存，且一个不起作用的输入仍可能阻止保存或产生离开提示。
- **待验收：**创建/编辑页面没有假排序入口，现有代表作品重排仍有效。

## F07 · 共享上限常量未复用，错误提示已经漂移

- **位置：**[work-errors.ts](../../../app/utils/work-errors.ts) L25–26；[featured.ts](../../../shared/constants/featured.ts) L2；[WorkOrderingControls.vue](../../../app/components/admin/WorkOrderingControls.vue)。
- **作用：**说明代表作品成员数量上限。
- **问题与证据：**`PUBLIC_FEATURED_LIMIT=5`，主要 UI/后端引用该常量，但 `FEATURED_LIMIT_REACHED` 文案仍写“最多设置4件”。这是静态确认的真实不一致。
- **最小建议：**错误提示直接引用现有共享常量，不新增配置或重复数字。
- **不处理后果：**超限时给出与实际规则矛盾的指引。
- **待验收：**相同业务规则各入口均显示5，未来修改常量不会遗留该硬编码。

## F08 · 两套旧管理 DTO 只剩测试调用

- **位置：**[work-mapper.ts](../../../server/utils/recipe/work-mapper.ts) L42–57；[media-mapper.ts](../../../server/utils/recipe/media-mapper.ts) L29–41、L109–119；[work.ts](../../../shared/schemas/work.ts) L182–195；[media.ts](../../../shared/schemas/media.ts) L38–46；[contracts.ts](../../../shared/types/contracts.ts) L144、L217。
- **作用：**旧 `toAdminWorkDto`、`toAdminAssetDto`、配套 Schema/类型定义管理投影。
- **问题与证据：**引用核对只发现旧链内部及 `tests/unit/contracts.test.ts`、`tests/unit/media-mapper.test.ts` 使用；真实管理接口使用 `ManagedWorkDto`/`VerifiedAssetDto`。部分隐私断言实际保护旧出口，增加维护成本。没有把内部仍调用的 `toPublicVariantDto` 等函数误判为死代码。
- **最小建议：**删旧链，必要的私有字段隔离断言迁到实际出口；检查类型导入和仍引用旧 Schema 名称的价格注释。
- **不处理后果：**维护两套 DTO，并可能误以为旧映射测试覆盖了现网出口。
- **精简计数：**7处声明/映射静态共65行（16+13+11+9+14+1+1），未计导入和测试；这是候选删除量，非已实现净减行数。
- **待验收：**旧链无残留业务引用，真实管理/公开出口的隐私保护仍有测试。

## F09 · 设定图与领养封面重复实现单图编辑流程

- **位置：**[DesignSheetSection.vue](../../../app/components/admin/DesignSheetSection.vue) L72起、L148–240；[AdoptionCoverSection.vue](../../../app/components/admin/AdoptionCoverSection.vue) L75起、L134–228；[useStudioPhotoUpload.ts](../../../app/composables/useStudioPhotoUpload.ts)。
- **作用：**维护作品的单张设定图或封面，包括上传、编辑和保存。
- **问题与证据：**两组件已共用底层上传，但上层仍分别维护 entry/baseline/dirty、文件选择、上传恢复、处理重试、保存和冲突反馈。修复共同恢复或保存行为时仍需同步改两处；此项是维护性发现，不宣称已复现数据丢失。
- **最小建议：**共享最小单图编辑状态与上传操作区域，继续使用现有上传 composable；各自预览、构图、字段和 endpoint 保留。不把整套图片编辑器参数化。
- **不处理后果：**相同状态逻辑继续分叉，修复容易遗漏一个入口。
- **待验收：**两种角色的上传/恢复、失败重试、保存冲突、草稿保留和锁定行为保持。

## F10 · 公开图片完整性校验重复三份

- **位置：**[media-recipe.ts](../../../server/utils/recipe/media-recipe.ts) L609–627；[site-display-recipe.ts](../../../server/utils/recipe/site-display-recipe.ts) L284–302；[contact-qr-recipe.ts](../../../server/utils/recipe/contact-qr-recipe.ts) L220–238。
- **作用：**确认存储的公开派生物与匿名访问到的字节、格式及尺寸一致。
- **问题与证据：**三处重复读取 HEAD、图片信息、匿名字节，再比较大小、MD5、SHA256、MIME 和尺寸；前两份几乎一致，二维码固定 PNG/方形。此处确认重复职责，不把 recipe 的全部差异视为冗余。
- **最小建议：**共享完整性检查，调用方明确传入预期格式和尺寸；保留各调用方的异常传播/转 false、重试和生成逻辑。
- **不处理后果：**加强验证时容易只修改一条媒体发布链路。
- **待验收：**成功及每类不匹配场景在三条链路保持一致，安全检查项不减少。

## F11 · Hero 与代表作品重复维护轮播控件显隐

- **位置：**[HomeHeroCarousel.vue](../../../app/components/HomeHeroCarousel.vue) L78起、L198起；[FeaturedWorks.vue](../../../app/components/FeaturedWorks.vue) L36起、L105起、L187起。
- **作用：**控制鼠标边缘/触屏操作时显示按钮，延时隐藏并清理定时器。
- **问题与证据：**自动播放已使用 `useCarouselPlayback`，但显隐 timer、边缘阈值、触屏显示、暂停后的保持和移出隐藏重复维护。
- **最小建议：**只抽取控件显隐行为与清理，两组件及各自布局/动画保留；不强制把所有轮播纳入同一组件。
- **不处理后果：**调整共同触控行为时需要重复修改，有后续漂移成本；尚无本项导致运行故障的复现。
- **待验收：**键盘/触控、暂停、移出、卸载及不同播放周期不变。

## F12 · 图片上传组件预留了没有使用者的后台主题

- **位置：**[ImageDropzoneCard.vue](../../../app/components/ImageDropzoneCard.vue) L2、L14、L97–98、L136起；唯一业务调用位于 [commission/apply.vue](../../../app/pages/commission/apply.vue) L492起。
- **作用：**公开委托表单选择、拖拽、更换或移除一张图片。
- **问题与证据：**现有调用只使用 public 主题，组件仍维护 admin/public 参数、动态 AdminAction/PublicAction 分支及后台 CSS。全局引用检查未发现后台调用方。
- **最小建议：**删除未使用的后台主题，固定公开按钮和样式；不要为了使用该参数而改造后台上传流程。
- **不处理后果：**继续维护未经真实调用验证的分支，增加修改成本；这是精简建议，不是已发生的故障。
- **待验收：**公开选择/拖拽/预览/更换/移除、禁用和错误关联保持，后台现有上传不受影响。

## 验证记录

以下为前两轮审查在本聊天中的执行结果摘要，本次文档归档没有重新运行它们。测试范围有交叠，计数不累加。未持久保存完整原始日志，不能把本节当作整改后的放行证据。

| 检查 | 已观察结果 | 局限 |
| --- | --- | --- |
| fetch、版本和工作树 | 文件树与上述 main 一致，审查期间无业务修改 | 只证明该 SHA，不代表未来 main |
| `pnpm check:fast` 中 lint/typecheck | 通过 | 默认并行 core 出现超时后中断，全命令不算通过 |
| 降并发 core（包含运行时套件） | `auth-api`、`health` 在启动/hook 阶段超时，未取得完整通过结果 | 不能直接归为业务断言失败，也未证明全部只是负载原因 |
| `pnpm test:core --maxWorkers=2 --exclude tests/integration/auth-api.test.ts --exclude tests/integration/health.test.ts` | 62文件：60通过、2失败；313测试：309通过、4失败 | commission-email 一项初始化 hook 超时；work-publication 两项30秒超时、一项初始化 hook 超时 |
| 串行定向 core：`tests/unit` 加 commission-retention、operation-lease、upload-session | 38文件、161测试全部通过 | 与前轮范围重叠，不含全部运行时/媒体发布测试，也不覆盖全部新增复现场景 |
| `pnpm test:smoke tests/smoke/main-journeys.spec.ts` | 19项：16通过、3失败 | 触控用例60秒超时；首页进入详情的 scrollY 为39而非0；登录等待未跳转到作品页 |
| 详情滚动独立复查 | 同一隔离服务下另开 Chrome，1440×900 两次进入详情均 scrollY=0 | 原失败尚未定位，不能宣布修复或纯属环境问题 |
| F01–F06 最小验证 | 结果见各条已有证据 | 内存库/合成 fixture、源码隔离执行或本地 HTTP；没有生产复现 |
| F07–F12 | 常量、调用方、声明数量和重复实现静态核对 | 没有执行精简后的行为验证，因尚未改代码 |

### 本轮文档验证

- 九文件模板结构齐全，原12条意见与规格/任务对应。
- 相对文件链接、编号、未完成状态和本轮改动范围检查通过。
- 未运行 release/manual、真实 OSS/SMTP、生产压测、生产部署或真实手机验收。

## 主要风险与后续评审

- 优先处理 F01/F02；恢复缺陷 F03–F05 需保留真实并发/生命周期边界。
- F06/F08 要查清真实请求与返回模型的差别；移除旧链不能误删活跃契约。
- F09–F11 不做全局万能抽象；以实际重复职责为边界，不以代码相似度报告直接决定合并。
- F01–F12 之外的审查前测试失败继续作为待排查事项，不凭一次复查通过关闭。
- 文档归档不构成独立整改 Review 或生产放行；完成整改后逐项追加证据与结论。

## 子代理评审记录

本轮及前两轮审查未使用子代理；没有独立子代理或人工验收结论可登记。

## 2026-10-08 整改结果

用户已追加授权严格按文档实施；下表为当前实现，不回写上文历史发现。没有新增依赖、Schema迁移、真实数据操作、提交/推送或部署。以下为作者实现复核，不冒充独立 Review。

| 编号 | 实现与回归依据 |
| --- | --- |
| F01 | 规范化申请 ID；事务内以版本/状态/资产关系取得持久删除权，编辑 SQL 要求删除标记为0。commission-retention 回归包含回执别名、独立数据库连接与独立Node进程编辑、盘点期间版本变化、失败重入。 |
| F02 | 安全中间件统一去除尾斜杠；新增 auth-security-paths 验证登录/统计/登出等价入口。编译后的 Nitro 产物额外核对登录缺失Origin的三种尾斜杠均403。 |
| F03 | 非重叠20秒恢复循环，每表最多50个、并发2个；排除本进程持有任务，防止慢任务被重复启动。operation-lease 回归覆盖快速重启、51条分批任务、有效租约与关闭。 |
| F04 | 活动 Map 包含请求在途时间，停止/销毁/替换使旧身份失效；终态异步回调在继续发起Hero启用/父级通知前再次检查。publication-polling 回归覆盖迟到响应和异步终态取消。 |
| F05 | 管理核验每20秒续写心跳，失活5分钟且未绑定资产才转FAILED；完成提交要求原版本和VALIDATING状态。upload-session/media-completion 回归覆盖活跃心跳、失活恢复、重试/清理候选与迟到提交回滚。 |
| F06 | 去掉手工排序字段、表单校验及dirty参与；写入请求保留可选旧字段兼容，读取DTO/精选重排保持。work-form/work-management与浏览器中无f-sort检查通过。 |
| F07 | FEATURED_LIMIT_REACHED 使用 PUBLIC_FEATURED_LIMIT，不再重复写死4。 |
| F08 | 移除两个旧管理DTO链；必要断言落到 getManagedWork/completeUploadSession 的真实返回值，公开投影保护保留。相关core通过。 |
| F09 | useSingleWorkImage共享单图编辑状态，WorkImageUploader共享上传操作，两个页面保留角色、预览和payload。新增浏览器测试验证两类上传、409拒绝后保留草稿、重试保存、刷新还原及390/1440无溢出。 |
| F10 | verifyPublicImage共享三处完整性校验，二维码调用明确PNG和方形；单元测试覆盖摘要/字节/格式/尺寸不符，原媒体recipe及发布core通过。 |
| F11 | useCarouselControls共享控件显隐、暂停及销毁清理；单元测试及首页触控/导航浏览器回归通过，3秒/4秒播放规则保留。 |
| F12 | 移除后台主题参数、动态AdminAction分支和专用样式；公开申请成功、拒绝重复、结果不确定保留输入的浏览器回归通过。 |

### 整改后验证清单

| 命令/检查 | 结果 |
| --- | --- |
| `pnpm lint`、`pnpm typecheck` | 最终通过 |
| `pnpm exec vitest run --config vitest.core.config.ts --maxWorkers=1 --exclude tests/integration/auth-api.test.ts --exclude tests/integration/health.test.ts` | 66文件、324测试通过，234.38秒 |
| 默认包含运行时套件的串行 core | Nuxt fixture 构建阶段长期未进入断言，人工中断；不算通过 |
| `NUXT_TEST_DEV=true` 下单独运行 auth-api/health，`--maxWorkers=1` | 18/19通过；最后的未知Host断言收到开发服务器的纯文本Blocked响应，JSON解析抛错并超时。测试本来针对生产请求边界，未为开发模式放宽期望。 |
| `pnpm build` | Nuxt/Nitro 构建与生产内容守卫通过；存在第三方注释/构建耗时提示，没有据此改依赖 |
| 编译产物隔离HTTP补验 | 临时目录与独立进程、显式Host：管理根302到登录，未知Host421且JSON契约正确，登录无Origin的零/一/两尾斜杠均403；临时进程与目录已清理。首次使用fetch探针没有得到预期Host响应，改用与原测试一致的node:http显式Host补验通过。 |
| `pnpm test:smoke tests/smoke/main-journeys.spec.ts tests/smoke/single-work-image.spec.ts tests/smoke/image-composition.spec.ts tests/smoke/hero-focal.spec.ts` | 25/25通过，4.7分钟；包括上轮失败的触控、滚动和登录用例 |
| 视觉与文档 | 已查看并归档双单图编辑器390/1440合成数据截图；链接/编号/状态与diff空白检查通过 |

核心测试、开发模式运行时与产物补验各有边界，不将其合写为“默认全量core通过”。上轮4项core超时和3项smoke失败在本次对应范围内未复现，不能声称根因均已证明为机器负载。

运行时代码（app/server/shared/scripts，包含新文件，不含测试和文档）本次净减362行；这是当前工作树相对审查基准的计数。保留测试与安全保护优先于行数。

### 未代签事项

- 独立 Review、真实手机/读屏与用户最终体验验收。
- 默认 Nuxt fixture 生产构建模式的整套运行时测试通过结果。
- 远程CI、镜像发布、生产部署，以及真实OSS/SMTP联调。

## workflow测试清理追加证据

用户追加授权后的实际清理与覆盖映射见 [CI测试清理交接](../implementation/notes/2026-10-08-CI-TEST-CLEANUP.md)。默认生产构建模式的合并运行时套件18/18通过，补齐上节该项未验证限制；其余独立Review/实机/远程CI和生产边界保持。

## PR #41异步Codex review补修

[评论](https://github.com/WangMinan/project-fur-forge/pull/41#discussion_r4217326517) 指出F01的删除标记不能提供两个删除者之间的独占，已用双连接回归复现并按用户授权在main补修。新增0056到期字段，使用递增版本认领、续租和提交隔离，独立进程/过期执行者/失败重入回归见 [修复记录](../implementation/notes/2026-10-08-PR41-DELETION-LEASE.md)。这不改变前述删除与编辑保护，也不代表已执行业务库迁移。
