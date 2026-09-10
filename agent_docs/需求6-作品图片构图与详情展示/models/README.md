# 模型说明：作品图片构图与详情展示

> 下列新增项已在本分支实现，0053为前向迁移。产品契约见 [SPEC](../requirements/SPEC.md)。

## 新增模型

### 作品展示偏好

works已增加与现有version一起受CAS保护的字段：

| 逻辑字段 | 持久化 | 默认 / 语义 |
| --- | --- | --- |
| showAdoptionCoverInDetail | 整数布尔列 | true；独立于来源选择 |
| showDesignSheetInDetail | 整数布尔列 | true；独立于来源选择 |
| adoptionCoverSource | 受限文本列 | auto / adoption_cover / design_sheet，默认 auto |
| imageCompositionVersion | 整数版本列 | 旧行 0，新建作品显式 1；逐作品媒体行为开关，不表示已发布 |

两个显隐和来源只对 adoption 作品适用；其他类型不开放该管理能力。升级 SQL 为历史行填 0，不把部署动作当成启用。旧作品第一次明确保存新构图（含完整显示或用途重置）时设为 1；实际公开效果在重新发布后生效。其他字段修改不提升此版本；没有独立的“升级全站图片”操作。

### work_asset_compositions

使用受限用途子表，不增加通用配置注册中心。主键为 `(work_id, asset_id, usage)`，关联 work_assets，列为 mode、x、y、width、height。

| usage（逻辑名） | 允许素材 | mode |
| --- | --- | --- |
| detail-thumbnail | studio_photo / adoption_cover / design_sheet | crop，1:1 |
| work-catalog | 三种作品素材 | crop，4:5；或 contain |
| home-featured | studio_photo | crop，3:4；或 contain |
| adoption-catalog | adoption_cover / design_sheet | crop，自由比例；或 contain |
| home-adoption | adoption_cover / design_sheet | crop，自由比例；或 contain |

- 无配置表示当前模式下的默认构图；contain 没有有效选区。显式 null 表示只重置该用途；省略表示保留，不等于 null。
- 坐标相对方向一致的完整源图，均为有限数；起点非负、宽高正、终点不超过 1。固定比例按 `源宽×width : 源高×height` 校验，不能判断归一化 width 是否等于 height。
- 同源图用于两个位置时配置独立；同一素材/选区/输出规格完全相同可复用文件。
- 不配置完整详情的裁切；详情始终完整。缩略图配置可以在当前图片未进入详情时保留，重新显示时继续使用。
- 与作品媒体关联重写的生命周期一起实现：保留相同 assetId 的所有未修改用途；真正解除关联/换新资产才移除旧关联配置，不删除永久原图。

## 已校准模型

| 当前事实 | 目标变化 |
| --- | --- |
| work_assets 只有一套 crop 与 focal | 保留为历史兼容输入；新构图不写回全局 assets 焦点 |
| work-card 固定 3:4，并被目录与首页共用 | 新模式按 work-catalog / home-featured 分用途取图；旧读取仍允许旧完整集合 |
| adoption-card 固定 16:9，详情复用 | 新模式增加从完整源图生成的横版封面详情来源，各封面用途另行取图 |
| detail / design-sheet 保留比例 | 复用完整输出能力，扩展到允许的横版封面角色，不改变原图 |
| asset_variants usage 为枚举 CHECK | 前向迁移扩展用途；Hero/site-display/私有角色限制不放宽 |
| PublicWorkGalleryItemDto 无缩略图来源 | 增加可兼容的 thumbnailSources；旧记录可回退 sources |
| media.gallery 限五张出厂照 | 保留原有数组与两类可选附加媒体，前端合成最多七张；不无条件把所有 position 上限扩大 |
| cardOrientation 兼任填充模式 | 新模式显式投影 fit；旧 DTO 缺失时沿用旧方向语义 |

## 字段处理规则

### 默认构图与旧焦点继承

新模式没有显式用途配置时，按下表确定默认值；“最大居中选区”指完整、方向统一源图内满足目标比例的最大矩形，居中放置，不放大或移动原图。

| 用途 / 素材 | 新模式默认 |
| --- | --- |
| 详情缩略图，三类素材 | 完整源图内最大居中1:1选区 |
| 作品目录，出厂照 | 完整源图内最大居中4:5选区 |
| 首页代表作品，出厂照 | 完整源图内最大居中3:4选区 |
| 作品目录，封面/设定图兜底 | contain，完整源图 |
| 领养目录 / 首页当前领养 | contain，完整源图；两处独立 |

历史作品在模式0时完全沿用旧文件，不用上述默认值替换公开内容。第一次保存新构图、进入模式1时，除管理员本次明确设置或重置的用途外，为当前主出厂照的目录与代表作品构图初始化显式选区：依据旧crop、服务端实际九宫格gravity及3:4成图几何还原源图中的可见范围；目录再计入原4:5容器的居中裁切。保存的是映射回完整源图的最终矩形，不从旧卡片像素重新裁，也不使用后台连续object-position猜测旧结果。

这一步只在当前作品的媒体保存事务中初始化配置，不生成图片、不批量升级其他作品；选区需在后台可预览。其他素材使用表中默认；下架会清理公开变体，因此初始化依据保留的主图关联、crop和gravity还原，不依赖旧文件仍存在。领养完整显示默认在该作品启用新模式并重新发布后生效，不要求保留旧16:9截断作为新模式默认。

旧焦点仅用于这次兼容初始化，不建立持续联动。此后“重置当前用途”恢复表中的新模式默认，不恢复旧焦点，也不改变其他用途。默认计算、像素取整和历史范围还原纳入几何验证。

### 管理接口映射

- 已扩展 `PUT /api/admin/v1/works/{id}/presentation` 的版本化 payload：保留已有 featured/sortOrder 调用，新增三个展示字段为可选局部更新；不得因默认值或省略字段覆盖其他偏好。
- 显隐/来源单独修改时更新 version，不改用于领养排序的 updated_at；原有 featured 更新行为不被顺手重写。
- 现有 studio-photos、adoption-cover、design-sheet 保存 payload 增加 compositions 映射，GET 返回保存值和当前实际来源。沿用各区域保存与脏状态。
- 对操作前后最终状态做事务校验：空图库、指定来源可用性、asset 所属作品/角色、版本及活动 publication 冲突。失败整体回滚。
- 数据库约束保证布尔/枚举/归一化范围与关联唯一性；依赖源图像素的比例与有效面积由服务端校验。

### 公开映射

- 同一 summary DTO 在作品目录、代表作品投影时分别填入该用途 card，不强制把所有用途图片都传给每个页面。
- 首页仍消费单个聚合 DTO；currentAdoptions 使用 home-adoption，领养列表使用 adoption-catalog，来源选择相同。
- adoptionCover、designSheet 始终表达真实素材；只在 getWorkBySlug 的详情输出筛选显隐，不污染共享快照。
- 附加媒体与出厂照均可带 thumbnailSources；前端组图库时透传，不丢字段。initialAssetId 必须属于最终可见图库。
- 保留显式公开 DTO allowlist，不向访客暴露选区编辑配置、内部版本控制细节或私有地址。

### 派生身份与兼容

旧 recipe-v4 不就地改变语义。新配方身份含来源摘要/处理中间图身份、用途、显示模式、有效选区、输出几何/格式/质量与新版本。

身份 hash 当前包含宽度和格式，不能假设整套图片共用一个 crop_identity 值。读取应根据生效配置计算每个档位的预期身份或等价确定映射，再验证完整集合；不能只筛 assetId＋usage＋recipeVersion，也不能随机取最新一张。

构图版本 0 只消费旧模式；版本 1 发布成功后消费新模式。部分新文件 READY 不代表可以提前切换；旧作品不因新字段或新用途缺失而消失。

## 迁移与启用

1. 只新增前向迁移；加入作品默认偏好、模式版本、用途子表及 variant 约束，检查所有旧数据可读。
2. 在临时旧库副本验证 Windows 与 Ubuntu 新建、重复迁移、升级兼容、外键与约束，不操作生产库。
3. 新建作品显式选择新模式；历史作品保存新构图时才进入逐件重新发布路径。
4. 更改仅显示设置的作品仍保留原有像素模式。旧已发布文件不批量重建、不覆盖、不自动删除。
5. 下架和失败清理沿用现有机制；本需求不增加存量云对象清理命令。代码/数据库回退限制在实际实施交接时记录，不承诺旧二进制理解新字段和新配方。

## 实施校准

- 五类新用途使用work-composition-v1；原有detail/design-sheet完整输出继续复用recipe-v4。contain别名解析到完整输出，相同的两个领养选区共享同一套派生物。
- 新模式公开取图按每个尺寸/格式的预期Key选整套，旧模式继续按完整旧配方回退。领养展示fit始终contain，完整展示所选区域。
- 空compositions对象不启用新模式；非空用途更新（包括null重置）才触发当前作品的版本切换。
- 比例校验采用真实像素比例的相对误差1e-5；像素取整与几何合法性分开。compositionOutputHeight / compositionMinimumDimensions由保存校验与配方共用，宽高需要的最大倍率均计入12000处理上限，预检暴露IMAGE_COMPOSITION_INVALID。
- Cropper交互基于固定完整图片与可移动/缩放选区；ResizeObserver重排时还原相同归一化选区。当前编辑预览沿用640/1280同源接口，未更改云存储边界。
