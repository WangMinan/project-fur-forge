import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

const timestampColumns = () => ({
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  sessionVersion: integer('session_version').notNull().default(1),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: integer('locked_until'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  version: integer('version').notNull().default(1),
  passwordChangedAt: integer('password_changed_at').notNull(),
  ...timestampColumns(),
}, table => [
  uniqueIndex('users_username_unique').on(table.username),
  check(
    'users_username_nonempty',
    sql`${table.username} = trim(${table.username}) AND length(${table.username}) BETWEEN 1 AND 100`,
  ),
  check('users_password_hash_nonempty', sql`length(${table.passwordHash}) > 0`),
  check('users_session_version_positive', sql`${table.sessionVersion} > 0`),
  check('users_failed_login_count_nonnegative', sql`${table.failedLoginCount} >= 0`),
  check('users_version_positive', sql`${table.version} > 0`),
])

export const works = sqliteTable('works', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  characterName: text('character_name').notNull(),
  species: text('species').notNull(),
  suitType: text('suit_type').notNull(),
  purpose: text('purpose').notNull(),
  adoptionMethod: text('adoption_method'),
  businessStatus: text('business_status'),
  /**
   * T37 轻量展会掉落：只保存展会名称与展会时间展示文本。
   *
   * `event_time` 是给访客看的文本（可表达单日、日期范围或已确认时段），
   * 不解析为调度时间，不驱动定时任务，也不自动改变领养状态。
   * 不新增 events 表、展会 slug、地点、摊位、主办方或历史归档。
   */
  eventName: text('event_name'),
  eventTime: text('event_time'),
  ownerDisplay: text('owner_display').notNull(),
  ownerContact: text('owner_contact'),
  priceAmountMinor: integer('price_amount_minor'),
  priceCurrency: text('price_currency'),
  publicationStatus: text('publication_status').notNull().default('draft'),
  sortOrder: integer('sort_order').notNull().default(0),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(1),
  publishedAt: integer('published_at'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('works_slug_unique').on(table.slug),
  index('works_publication_sort_idx')
    .on(table.publicationStatus, table.sortOrder),
  check(
    'works_slug_nonempty',
    sql`${table.slug} = trim(${table.slug}) AND length(${table.slug}) BETWEEN 1 AND 120`,
  ),
  check(
    'works_character_name_nonempty',
    sql`${table.characterName} = trim(${table.characterName}) AND length(${table.characterName}) BETWEEN 1 AND 100`,
  ),
  check(
    'works_species_nonempty',
    sql`${table.species} = trim(${table.species}) AND length(${table.species}) BETWEEN 1 AND 100`,
  ),
  check('works_suit_type', sql`${table.suitType} IN ('full', 'partial')`),
  check(
    'works_purpose',
    sql`${table.purpose} IN ('commission', 'adoption', 'showcase')`,
  ),
  check(
    'works_adoption_method',
    sql`${table.adoptionMethod} IS NULL OR ${table.adoptionMethod} IN ('regular', 'event_drop')`,
  ),
  check(
    'works_adoption_fields',
    sql`(${table.purpose} = 'adoption') OR (${table.adoptionMethod} IS NULL AND ${table.businessStatus} IS NULL AND ${table.eventName} IS NULL AND ${table.eventTime} IS NULL AND ${table.priceAmountMinor} IS NULL AND ${table.priceCurrency} IS NULL)`,
  ),
  /**
   * 展会字段成组约束。
   *
   * - 非 event_drop 作品两项必须为空：切换离开掉落后不会留下僵尸值；
   * - event_drop 草稿允许只填一项或都不填（编辑过程中的正常中间状态），
   *   但**已发布**的掉落两项必须去空白后非空；
   * - 与 alt、设定图同一套心智：草稿可以不完整，发布检查负责拦截。
   */
  check(
    'works_event_drop_fields',
    sql`CASE WHEN ${table.purpose} = 'adoption' AND ${table.adoptionMethod} = 'event_drop' THEN (${table.eventName} IS NULL OR length(trim(${table.eventName})) BETWEEN 1 AND 80) AND (${table.eventTime} IS NULL OR length(trim(${table.eventTime})) BETWEEN 1 AND 80) AND (${table.publicationStatus} != 'published' OR (${table.eventName} IS NOT NULL AND ${table.eventTime} IS NOT NULL)) ELSE ${table.eventName} IS NULL AND ${table.eventTime} IS NULL END`,
  ),
  check(
    'works_business_status',
    sql`${table.businessStatus} IS NULL OR ${table.businessStatus} IN ('preparing', 'available', 'event_sale', 'scheduled', 'in_production', 'delivered')`,
  ),
  check(
    'works_event_sale',
    sql`${table.businessStatus} != 'event_sale' OR (${table.adoptionMethod} = 'event_drop' AND length(trim(${table.eventName})) > 0)`,
  ),
  check(
    'works_owner_display_nonempty',
    sql`${table.ownerDisplay} = trim(${table.ownerDisplay}) AND length(${table.ownerDisplay}) BETWEEN 1 AND 100`,
  ),
  check(
    'works_price_cny',
    sql`(${table.priceAmountMinor} IS NULL AND ${table.priceCurrency} IS NULL) OR (${table.purpose} = 'adoption' AND ${table.priceAmountMinor} > 0 AND ${table.priceCurrency} = 'CNY')`,
  ),
  check(
    'works_publication_status',
    sql`${table.publicationStatus} IN ('draft', 'published', 'unpublished')`,
  ),
  check('works_sort_order_nonnegative', sql`${table.sortOrder} >= 0`),
  check('works_version_positive', sql`${table.version} > 0`),
])

export const workFeatureTags = sqliteTable('work_feature_tags', {
  workId: text('work_id').notNull()
    .references(() => works.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  value: text('value').notNull(),
}, table => [
  primaryKey({ columns: [table.workId, table.position] }),
  uniqueIndex('work_feature_tags_value_unique')
    .on(table.workId, table.value),
  check(
    'work_feature_tags_position',
    sql`${table.position} BETWEEN 0 AND 7`,
  ),
  check(
    'work_feature_tags_value',
    sql`${table.value} = trim(${table.value}) AND length(${table.value}) BETWEEN 1 AND 24`,
  ),
])

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  status: text('status').notNull().default('PENDING'),
  privateObjectKey: text('private_object_key').notNull(),
  sha256: text('sha256').notNull(),
  byteSize: integer('byte_size').notNull(),
  mimeType: text('mime_type').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  exifOrientation: integer('exif_orientation').notNull().default(1),
  focalX: real('focal_x').notNull().default(0.5),
  focalY: real('focal_y').notNull().default(0.5),
  fitMode: text('fit_mode').notNull().default('cover'),
  watermarkAnchor: text('watermark_anchor').notNull().default('top-left'),
  version: integer('version').notNull().default(1),
  internalErrorCode: text('internal_error_code'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('assets_private_object_key_unique')
    .on(table.privateObjectKey),
  check(
    'assets_role',
    sql`${table.role} IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo', 'return_photo', 'contact_qr')`,
  ),
  check(
    'assets_status',
    sql`${table.status} IN ('PENDING', 'READY', 'FAILED')`,
  ),
  check(
    'assets_private_key_relative',
    sql`length(trim(${table.privateObjectKey})) > 0 AND instr(${table.privateObjectKey}, '://') = 0 AND substr(${table.privateObjectKey}, 1, 1) != '/'`,
  ),
  check(
    'assets_sha256',
    sql`length(${table.sha256}) = 64 AND ${table.sha256} = lower(${table.sha256}) AND ${table.sha256} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'assets_byte_size',
    sql`${table.byteSize} BETWEEN 1 AND 30000000`,
  ),
  check(
    'assets_dimensions',
    sql`${table.width} BETWEEN 1 AND 12000 AND ${table.height} BETWEEN 1 AND 12000`,
  ),
  check(
    'assets_exif_orientation',
    sql`${table.exifOrientation} BETWEEN 1 AND 8`,
  ),
  check(
    'assets_focus',
    sql`${table.focalX} BETWEEN 0 AND 1 AND ${table.focalY} BETWEEN 0 AND 1`,
  ),
  check(
    'assets_fit_mode',
    sql`${table.fitMode} IN ('cover', 'contain')`,
  ),
  check(
    'assets_watermark_anchor',
    sql`${table.watermarkAnchor} IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')`,
  ),
  check(
    'assets_hero_orientation',
    sql`(${table.role} != 'home_hero_landscape' OR ${table.width} > ${table.height}) AND (${table.role} != 'home_hero_portrait' OR ${table.height} > ${table.width})`,
  ),
  check(
    'assets_mime_type',
    sql`${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`,
  ),
  check(
    'assets_watermark_logo_png',
    sql`${table.role} != 'watermark_logo' OR (${table.mimeType} = 'image/png' AND ${table.byteSize} <= 20000000)`,
  ),
  check(
    'assets_contact_qr_png',
    sql`${table.role} != 'contact_qr' OR (${table.mimeType} = 'image/png' AND ${table.byteSize} <= 20000000 AND ${table.width} = ${table.height} AND ${table.width} >= 320 AND ${table.fitMode} = 'contain')`,
  ),
  check('assets_version_positive', sql`${table.version} > 0`),
])

export const watermarkProfiles = sqliteTable('watermark_profiles', {
  id: text('id').primaryKey(),
  profileName: text('profile_name').notNull(),
  sourceAssetId: text('source_asset_id').notNull()
    .references(() => assets.id, { onDelete: 'restrict' }),
  logoDigest: text('logo_digest').notNull(),
  position: text('position').notNull().default('center'),
  opacityPercent: integer('opacity_percent').notNull().default(50),
  scalePercent: integer('scale_percent').notNull().default(60),
  configDigest: text('config_digest').notNull(),
  status: text('status').notNull().default('DRAFT'),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  index('watermark_profiles_config_digest_idx')
    .on(table.configDigest),
  index('watermark_profiles_source_asset_idx').on(table.sourceAssetId),
  check(
    'watermark_profiles_name',
    sql`${table.profileName} = 'brand-centered-v2'`,
  ),
  check('watermark_profiles_position', sql`${table.position} = 'center'`),
  check(
    'watermark_profiles_opacity',
    sql`${table.opacityPercent} BETWEEN 10 AND 90`,
  ),
  check(
    'watermark_profiles_scale',
    sql`${table.scalePercent} BETWEEN 20 AND 90`,
  ),
  check(
    'watermark_profiles_logo_digest',
    sql`length(${table.logoDigest}) = 64 AND ${table.logoDigest} = lower(${table.logoDigest}) AND ${table.logoDigest} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'watermark_profiles_config_digest',
    sql`length(${table.configDigest}) = 64 AND ${table.configDigest} = lower(${table.configDigest}) AND ${table.configDigest} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'watermark_profiles_status',
    sql`${table.status} IN ('DRAFT', 'APPLYING', 'ACTIVE', 'RETIRED', 'FAILED')`,
  ),
  check('watermark_profiles_version_positive', sql`${table.version} > 0`),
])

export const uploadSessions = sqliteTable('upload_sessions', {
  id: text('id').primaryKey(),
  ownerType: text('owner_type').notNull(),
  ownerId: text('owner_id').notNull(),
  ownerVersion: integer('owner_version').notNull(),
  mediaRole: text('media_role').notNull(),
  privateObjectKey: text('private_object_key').notNull(),
  expectedContentType: text('expected_content_type').notNull(),
  expectedBytes: integer('expected_bytes').notNull(),
  expectedContentMd5: text('expected_content_md5').notNull(),
  expectedSha256: text('expected_sha256').notNull(),
  expectedWidth: integer('expected_width').notNull(),
  expectedHeight: integer('expected_height').notNull(),
  createdBy: text('created_by').notNull()
    .references(() => users.id),
  status: text('status').notNull().default('AWAITING_UPLOAD'),
  assetId: text('asset_id')
    .references(() => assets.id),
  version: integer('version').notNull().default(1),
  failureCode: text('failure_code'),
  failureStage: text('failure_stage'),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  /** T34-F5：过期上传会话清扫完成时间；已清扫的会话不再重复扫描。 */
  cleanedAt: integer('cleaned_at'),
}, table => [
  uniqueIndex('upload_sessions_private_object_key_unique')
    .on(table.privateObjectKey),
  index('upload_sessions_owner_idx')
    .on(table.ownerType, table.ownerId, table.createdAt),
  index('upload_sessions_expiry_idx')
    .on(table.status, table.expiresAt),
  check(
    'upload_sessions_owner_type',
    sql`${table.ownerType} IN ('work', 'site', 'return')`,
  ),
  check(
    'upload_sessions_owner_id',
    sql`length(trim(${table.ownerId})) > 0 AND (${table.ownerType} != 'site' OR ${table.ownerId} IN ('home', 'branding', 'contact'))`,
  ),
  check(
    'upload_sessions_owner_version',
    sql`${table.ownerVersion} >= 0`,
  ),
  check(
    'upload_sessions_media_role',
    sql`(${table.ownerType} = 'work' AND ${table.mediaRole} IN ('design_sheet', 'studio_photo')) OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'home' AND ${table.mediaRole} IN ('home_hero_landscape', 'home_hero_portrait')) OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'branding' AND ${table.mediaRole} = 'watermark_logo') OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'contact' AND ${table.mediaRole} = 'contact_qr') OR (${table.ownerType} = 'return' AND ${table.mediaRole} = 'return_photo')`,
  ),
  check(
    'upload_sessions_private_key_relative',
    sql`length(trim(${table.privateObjectKey})) > 0 AND instr(${table.privateObjectKey}, '://') = 0 AND substr(${table.privateObjectKey}, 1, 1) != '/'`,
  ),
  check(
    'upload_sessions_content_type',
    sql`${table.expectedContentType} IN ('image/jpeg', 'image/png', 'image/webp')`,
  ),
  check(
    'upload_sessions_watermark_logo_png',
    sql`${table.mediaRole} != 'watermark_logo' OR (${table.expectedContentType} = 'image/png' AND ${table.expectedBytes} <= 20000000)`,
  ),
  check(
    'upload_sessions_contact_qr_png',
    sql`${table.mediaRole} != 'contact_qr' OR (${table.expectedContentType} = 'image/png' AND ${table.expectedBytes} <= 20000000 AND ${table.expectedWidth} = ${table.expectedHeight} AND ${table.expectedWidth} >= 320)`,
  ),
  check(
    'upload_sessions_expected_bytes',
    sql`${table.expectedBytes} BETWEEN 1 AND 30000000`,
  ),
  check(
    'upload_sessions_expected_md5',
    sql`length(${table.expectedContentMd5}) = 24`,
  ),
  check(
    'upload_sessions_expected_sha256',
    sql`length(${table.expectedSha256}) = 64 AND ${table.expectedSha256} = lower(${table.expectedSha256}) AND ${table.expectedSha256} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'upload_sessions_expected_dimensions',
    sql`${table.expectedWidth} BETWEEN 1 AND 12000 AND ${table.expectedHeight} BETWEEN 1 AND 12000`,
  ),
  check(
    'upload_sessions_status',
    sql`${table.status} IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')`,
  ),
  check(
    'upload_sessions_asset_state',
    sql`(${table.status} = 'COMPLETED' AND ${table.assetId} IS NOT NULL) OR (${table.status} != 'COMPLETED' AND ${table.assetId} IS NULL)`,
  ),
  check(
    'upload_sessions_failure_state',
    sql`(${table.status} = 'FAILED' AND ${table.failureCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.failureCode} IS NULL AND ${table.failureStage} IS NULL)`,
  ),
  check(
    'upload_sessions_failure_stage',
    sql`${table.failureStage} IS NULL OR ${table.failureStage} IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')`,
  ),
  check(
    'upload_sessions_expiry',
    sql`${table.expiresAt} = ${table.createdAt} + 300000`,
  ),
  check('upload_sessions_version_positive', sql`${table.version} > 0`),
])

export const assetVariants = sqliteTable('asset_variants', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  sourceVariantId: text('source_variant_id')
    .references((): AnySQLiteColumn => assetVariants.id),
  storageScope: text('storage_scope').notNull(),
  status: text('status').notNull().default('PENDING'),
  objectKey: text('object_key').notNull(),
  inputSha256: text('input_sha256').notNull(),
  mediaRole: text('media_role').notNull(),
  usage: text('usage').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  format: text('format').notNull(),
  quality: integer('quality').notNull(),
  cropIdentity: text('crop_identity').notNull(),
  recipeVersion: text('recipe_version').notNull(),
  protectionMode: text('protection_mode').notNull().default('watermark'),
  watermarkProfile: text('watermark_profile').notNull(),
  watermarkProfileId: text('watermark_profile_id')
    .references(() => watermarkProfiles.id, { onDelete: 'restrict' }),
  watermarkConfigDigest: text('watermark_config_digest').notNull().default('none'),
  logoDigest: text('logo_digest').notNull(),
  watermarkAnchor: text('watermark_anchor').notNull(),
  watermarkOpacityPercent: integer('watermark_opacity_percent'),
  watermarkScalePercent: integer('watermark_scale_percent'),
  sha256: text('sha256'),
  byteSize: integer('byte_size'),
  version: integer('version').notNull().default(1),
  internalErrorCode: text('internal_error_code'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('asset_variants_object_key_unique').on(table.objectKey),
  uniqueIndex('asset_variants_legacy_identity_unique').on(
    table.assetId,
    table.inputSha256,
    table.mediaRole,
    table.usage,
    table.width,
    table.height,
    table.format,
    table.quality,
    table.cropIdentity,
    table.recipeVersion,
    table.watermarkProfile,
    table.logoDigest,
    table.watermarkAnchor,
  ).where(sql`${table.watermarkProfileId} IS NULL`),
  uniqueIndex('asset_variants_profile_identity_unique').on(
    table.assetId,
    table.inputSha256,
    table.mediaRole,
    table.usage,
    table.width,
    table.height,
    table.format,
    table.quality,
    table.cropIdentity,
    table.recipeVersion,
    table.watermarkProfileId,
    table.watermarkConfigDigest,
    table.logoDigest,
    table.watermarkAnchor,
    table.watermarkOpacityPercent,
    table.watermarkScalePercent,
  ).where(sql`${table.watermarkProfileId} IS NOT NULL`),
  index('asset_variants_public_lookup_idx')
    .on(table.assetId, table.storageScope, table.status, table.usage),
  index('asset_variants_protection_idx')
    .on(table.storageScope, table.protectionMode, table.usage, table.status),
  check(
    'asset_variants_storage_scope',
    sql`${table.storageScope} IN ('PRIVATE', 'PUBLIC')`,
  ),
  check(
    'asset_variants_status',
    sql`${table.status} IN ('PENDING', 'READY', 'FAILED')`,
  ),
  check(
    'asset_variants_key_relative',
    sql`length(trim(${table.objectKey})) > 0 AND instr(${table.objectKey}, '://') = 0 AND substr(${table.objectKey}, 1, 1) != '/'`,
  ),
  check(
    'asset_variants_input_sha256',
    sql`length(${table.inputSha256}) = 64 AND ${table.inputSha256} = lower(${table.inputSha256}) AND ${table.inputSha256} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'asset_variants_media_role',
    sql`${table.mediaRole} IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'return_photo', 'contact_qr')`,
  ),
  check(
    'asset_variants_usage',
    sql`${table.usage} IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'return-wall', 'contact-qr')`,
  ),
  check(
    'asset_variants_dimensions',
    sql`${table.width} BETWEEN 1 AND 12000 AND ${table.height} BETWEEN 1 AND 12000`,
  ),
  check(
    'asset_variants_format',
    sql`${table.format} IN ('webp', 'jpeg', 'png')`,
  ),
  check(
    'asset_variants_quality',
    sql`${table.quality} BETWEEN 1 AND 100`,
  ),
  check(
    'asset_variants_identity_text',
    sql`length(trim(${table.cropIdentity})) > 0 AND length(trim(${table.recipeVersion})) > 0 AND length(trim(${table.watermarkProfile})) > 0`,
  ),
  check(
    'asset_variants_logo_digest',
    sql`${table.logoDigest} = 'none' OR (length(${table.logoDigest}) = 64 AND ${table.logoDigest} = lower(${table.logoDigest}) AND ${table.logoDigest} NOT GLOB '*[^0-9a-f]*')`,
  ),
  check(
    'asset_variants_watermark_anchor',
    sql`${table.watermarkAnchor} IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')`,
  ),
  check(
    'asset_variants_watermark_config_digest',
    sql`${table.watermarkConfigDigest} = 'none' OR (length(${table.watermarkConfigDigest}) = 64 AND ${table.watermarkConfigDigest} = lower(${table.watermarkConfigDigest}) AND ${table.watermarkConfigDigest} NOT GLOB '*[^0-9a-f]*')`,
  ),
  check(
    'asset_variants_protection_mode',
    sql`${table.protectionMode} IN ('none', 'watermark')`,
  ),
  check(
    'asset_variants_unprotected_identity',
    sql`${table.protectionMode} != 'none' OR (${table.watermarkProfile} = 'none' AND ${table.watermarkProfileId} IS NULL AND ${table.watermarkConfigDigest} = 'none' AND ${table.logoDigest} = 'none' AND ${table.watermarkAnchor} = 'none' AND ${table.watermarkOpacityPercent} IS NULL AND ${table.watermarkScalePercent} IS NULL)`,
  ),
  check(
    'asset_variants_site_display_recipe',
    sql`${table.recipeVersion} != 'site-display-v1' OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.usage} IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))`,
  ),
  check(
    'asset_variants_site_display_usage',
    sql`${table.usage} NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.recipeVersion} = 'site-display-v1')`,
  ),
  check(
    'asset_variants_public_protection',
    sql`${table.storageScope} != 'PUBLIC' OR ${table.protectionMode} = 'watermark' OR ${table.recipeVersion} IN ('site-display-v1', 'return-display-v1', 'contact-qr-v1')`,
  ),
  /**
   * T36 返图公开变体：只允许 return-wall 用途、公开范围、无保护模式。
   * 与 site-display 分开写，保证返图不会借用站点展示用途，
   * 也保证水印身份列全部为 none/NULL（由 unprotected_identity 兜底）。
   */
  check(
    'asset_variants_return_display_recipe',
    sql`${table.recipeVersion} != 'return-display-v1' OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.usage} = 'return-wall' AND ${table.mediaRole} = 'return_photo')`,
  ),
  check(
    'asset_variants_return_wall_usage',
    sql`${table.usage} != 'return-wall' OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.recipeVersion} = 'return-display-v1' AND ${table.mediaRole} = 'return_photo')`,
  ),
  /** 返图原图只允许 preprocess 与 return-wall，不得冒充作品或站点展示位。 */
  check(
    'asset_variants_return_photo_role',
    sql`${table.mediaRole} != 'return_photo' OR ${table.usage} IN ('preprocess', 'return-wall')`,
  ),
  check(
    'asset_variants_contact_qr_recipe',
    sql`${table.recipeVersion} != 'contact-qr-v1' OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.usage} = 'contact-qr' AND ${table.mediaRole} = 'contact_qr' AND ${table.format} = 'png' AND ${table.width} = ${table.height})`,
  ),
  check(
    'asset_variants_contact_qr_usage',
    sql`${table.usage} != 'contact-qr' OR (${table.storageScope} = 'PUBLIC' AND ${table.protectionMode} = 'none' AND ${table.recipeVersion} = 'contact-qr-v1' AND ${table.mediaRole} = 'contact_qr' AND ${table.format} = 'png' AND ${table.width} = ${table.height})`,
  ),
  check(
    'asset_variants_contact_qr_role',
    sql`${table.mediaRole} != 'contact_qr' OR ${table.usage} IN ('preprocess', 'contact-qr')`,
  ),
  check(
    'asset_variants_public_watermark',
    sql`${table.storageScope} != 'PUBLIC' OR ${table.protectionMode} != 'watermark' OR ((${table.watermarkProfile} = 'brand-standard-v1' AND ${table.watermarkProfileId} IS NULL AND ${table.watermarkConfigDigest} = 'none' AND ${table.logoDigest} != 'none' AND ${table.watermarkAnchor} IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND ${table.watermarkOpacityPercent} IS NULL AND ${table.watermarkScalePercent} IS NULL) OR (${table.watermarkProfile} = 'brand-centered-v2' AND ${table.watermarkProfileId} IS NOT NULL AND ${table.watermarkConfigDigest} != 'none' AND ${table.logoDigest} != 'none' AND ${table.watermarkAnchor} = 'center' AND ${table.watermarkOpacityPercent} BETWEEN 10 AND 90 AND ${table.watermarkScalePercent} BETWEEN 20 AND 90))`,
  ),
  check(
    'asset_variants_preprocess_private',
    sql`${table.usage} != 'preprocess' OR (${table.storageScope} = 'PRIVATE' AND ${table.protectionMode} = 'none' AND ${table.watermarkProfile} = 'none' AND ${table.watermarkProfileId} IS NULL AND ${table.watermarkConfigDigest} = 'none' AND ${table.logoDigest} = 'none' AND ${table.watermarkAnchor} = 'none' AND ${table.watermarkOpacityPercent} IS NULL AND ${table.watermarkScalePercent} IS NULL)`,
  ),
  check(
    'asset_variants_private_unprotected',
    sql`${table.storageScope} != 'PRIVATE' OR ${table.protectionMode} = 'none'`,
  ),
  check(
    'asset_variants_ready_output',
    sql`${table.status} != 'READY' OR (${table.sha256} IS NOT NULL AND length(${table.sha256}) = 64 AND ${table.byteSize} > 0)`,
  ),
  check('asset_variants_version_positive', sql`${table.version} > 0`),
])

export const workAssets = sqliteTable('work_assets', {
  workId: text('work_id').notNull()
    .references(() => works.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull()
    .references(() => assets.id),
  role: text('role').notNull(),
  altText: text('alt_text'),
  position: integer('position').notNull(),
  primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  focalX: real('focal_x').notNull().default(0.5),
  focalY: real('focal_y').notNull().default(0.5),
  cropX: real('crop_x').notNull().default(0),
  cropY: real('crop_y').notNull().default(0),
  cropWidth: real('crop_width').notNull().default(1),
  cropHeight: real('crop_height').notNull().default(1),
  watermarkAnchor: text('watermark_anchor').notNull().default('top-left'),
}, table => [
  primaryKey({ columns: [table.workId, table.assetId] }),
  uniqueIndex('work_assets_asset_unique').on(table.assetId),
  uniqueIndex('work_assets_position_unique')
    .on(table.workId, table.role, table.position),
  uniqueIndex('work_assets_primary_unique')
    .on(table.workId, table.role)
    .where(sql`${table.primary} = 1`),
  check(
    'work_assets_role',
    sql`${table.role} IN ('design_sheet', 'studio_photo')`,
  ),
  check(
    'work_assets_alt_text',
    sql`${table.altText} IS NULL OR (${table.altText} = trim(${table.altText}) AND length(${table.altText}) BETWEEN 1 AND 500)`,
  ),
  check(
    'work_assets_position',
    sql`(${table.role} = 'design_sheet' AND ${table.position} = 0) OR (${table.role} = 'studio_photo' AND ${table.position} BETWEEN 0 AND 4)`,
  ),
  check(
    'work_assets_focus',
    sql`${table.focalX} BETWEEN 0 AND 1 AND ${table.focalY} BETWEEN 0 AND 1`,
  ),
  check(
    'work_assets_crop',
    sql`${table.cropX} BETWEEN 0 AND 1 AND ${table.cropY} BETWEEN 0 AND 1 AND ${table.cropWidth} > 0 AND ${table.cropWidth} <= 1 AND ${table.cropHeight} > 0 AND ${table.cropHeight} <= 1 AND ${table.cropX} + ${table.cropWidth} <= 1 AND ${table.cropY} + ${table.cropHeight} <= 1`,
  ),
  check(
    'work_assets_watermark_anchor',
    sql`${table.watermarkAnchor} IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')`,
  ),
])

/**
 * T35-F1 返图设定：返图的归属主体，与作品彻底解耦。
 *
 * 设定有自己的名称、公开 slug 和可选 `@昵称`，因此老作品没上过架、
 * 甚至根本没有作品记录时也可以有返图。`work_id` 是可选便利入口，
 * ON DELETE set null：作品被永久删除只是失去入口，返图与私有原图保留。
 *
 * 授权三列（来源 / 确认时间 / 内部备注）按设定保存——授权是“这个人同意
 * 公开自己设定的返图”，与单张照片无关。三列全部可空，缺失不阻止发布，
 * 且只进入受认证管理 DTO；公开投影永不读取。
 */
export const returnCharacters = sqliteTable('return_characters', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  workId: text('work_id')
    .references(() => works.id, { onDelete: 'set null' }),
  authorizationSource: text('authorization_source'),
  authorizationConfirmedAt: integer('authorization_confirmed_at'),
  authorizationNote: text('authorization_note'),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  uniqueIndex('return_characters_slug_unique').on(table.slug),
  index('return_characters_work_idx').on(table.workId),
  check(
    'return_characters_slug_nonempty',
    sql`${table.slug} = trim(${table.slug}) AND length(${table.slug}) BETWEEN 1 AND 120`,
  ),
  check(
    'return_characters_name_nonempty',
    sql`${table.name} = trim(${table.name}) AND length(${table.name}) BETWEEN 1 AND 100`,
  ),
  check(
    'return_characters_nickname',
    sql`${table.nickname} IS NULL OR (${table.nickname} = trim(${table.nickname}) AND length(${table.nickname}) BETWEEN 1 AND 50)`,
  ),
  check('return_characters_version_positive', sql`${table.version} > 0`),
  check(
    'return_characters_authorization_source',
    sql`${table.authorizationSource} IS NULL OR ${table.authorizationSource} IN ('qq', 'email', 'other')`,
  ),
  check(
    'return_characters_authorization_confirmed_at',
    sql`${table.authorizationConfirmedAt} IS NULL OR ${table.authorizationConfirmedAt} > 0`,
  ),
  check(
    'return_characters_authorization_note',
    sql`${table.authorizationNote} IS NULL OR (${table.authorizationNote} = trim(${table.authorizationNote}) AND length(${table.authorizationNote}) BETWEEN 1 AND 500)`,
  ),
])

/**
 * T35-F1 返图照片：一张返图一行，归属一个设定。
 *
 * 一个设定可以有多张返图，横竖混放。`asset_id` 唯一约束保证同一张
 * 私有原图不被两条返图占用；`is_primary` 部分唯一索引保证一个设定
 * 最多一张主图（设定页的圆形头像）。
 *
 * 不设 `sort_order`：返图墙每次请求随机打乱，人工排序没有意义。
 * `character_id` 使用 ON DELETE restrict：删除设定前必须先处理它的返图。
 * `asset_id` 同样 restrict，永久原图不会因删除返图记录被级联清空。
 */
export const returnPhotos = sqliteTable('return_photos', {
  id: text('id').primaryKey(),
  characterId: text('character_id').notNull()
    .references(() => returnCharacters.id, { onDelete: 'restrict' }),
  /**
   * 草稿可以先没有图片：返图上传会话的归属是设定及其版本，
   * 照片记录先建后补图。发布前检查要求一张 READY `return_photo` 资产，
   * 并由 `return_photos_published_asset` CHECK 在数据库层兜住。
   */
  assetId: text('asset_id')
    .references(() => assets.id, { onDelete: 'restrict' }),
  alt: text('alt').notNull(),
  primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  publicationStatus: text('publication_status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  publishedAt: integer('published_at'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('return_photos_asset_unique').on(table.assetId),
  uniqueIndex('return_photos_primary_unique').on(table.characterId)
    .where(sql`${table.primary} = 1`),
  index('return_photos_character_idx')
    .on(table.characterId, table.publicationStatus),
  index('return_photos_public_idx').on(table.publicationStatus, table.id),
  check(
    'return_photos_alt_nonempty',
    sql`${table.alt} = trim(${table.alt}) AND length(${table.alt}) BETWEEN 1 AND 500`,
  ),
  check(
    'return_photos_publication_status',
    sql`${table.publicationStatus} IN ('draft', 'published', 'unpublished')`,
  ),
  check('return_photos_version_positive', sql`${table.version} > 0`),
  check(
    'return_photos_published_at',
    sql`${table.publicationStatus} != 'published' OR ${table.publishedAt} IS NOT NULL`,
  ),
  /** 已发布返图必须有图片；草稿允许暂时为空。 */
  check(
    'return_photos_published_asset',
    sql`${table.publicationStatus} != 'published' OR ${table.assetId} IS NOT NULL`,
  ),
  /** 主图必须真的有图片：没有图片的草稿不能当设定封面。 */
  check(
    'return_photos_primary_asset',
    sql`${table.primary} = 0 OR ${table.assetId} IS NOT NULL`,
  ),
])

/**
 * T46 最小第一方统计。
 *
 * 表只保存服务端时间、规范枚举、可选公开实体 ID、白名单联系行动与域分离
 * HMAC。IP、UA、Referer、原始 URL/query、Cookie、联系方式和原始会话 ID
 * 没有列，也不能借通用 JSON 扩展进入数据库。
 */
export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  occurredAt: integer('occurred_at').notNull(),
  eventType: text('event_type').notNull(),
  routeKey: text('route_key').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  actionKey: text('action_key'),
  sessionHmac: text('session_hmac').notNull(),
}, table => [
  index('analytics_events_occurred_idx').on(table.occurredAt),
  index('analytics_events_type_occurred_idx')
    .on(table.eventType, table.occurredAt),
  index('analytics_events_route_occurred_idx')
    .on(table.routeKey, table.occurredAt),
  index('analytics_events_entity_occurred_idx')
    .on(table.entityType, table.entityId, table.occurredAt),
  check(
    'analytics_events_event_type',
    sql`${table.eventType} IN ('page_view', 'contact_action')`,
  ),
  check(
    'analytics_events_route_key',
    sql`${table.routeKey} IN ('home', 'works', 'work_detail', 'returns', 'return_character', 'commission', 'adoptions', 'about', 'service', 'privacy', 'licenses')`,
  ),
  check(
    'analytics_events_entity_type',
    sql`${table.entityType} IS NULL OR ${table.entityType} IN ('work', 'return_character')`,
  ),
  check(
    'analytics_events_action_key',
    sql`${table.actionKey} IS NULL OR ${table.actionKey} IN ('email_open', 'email_copy')`,
  ),
  check(
    'analytics_events_session_hmac',
    sql`length(${table.sessionHmac}) = 64 AND ${table.sessionHmac} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'analytics_events_shape',
    sql`CASE WHEN ${table.eventType} = 'contact_action' THEN ${table.routeKey} IN ('about', 'commission') AND ${table.actionKey} IS NOT NULL AND ${table.entityType} IS NULL AND ${table.entityId} IS NULL WHEN ${table.routeKey} = 'work_detail' THEN ${table.entityType} = 'work' AND ${table.entityId} IS NOT NULL AND ${table.actionKey} IS NULL WHEN ${table.routeKey} = 'return_character' THEN ${table.entityType} = 'return_character' AND ${table.entityId} IS NOT NULL AND ${table.actionKey} IS NULL ELSE ${table.entityType} IS NULL AND ${table.entityId} IS NULL AND ${table.actionKey} IS NULL END`,
  ),
])

export const siteHeroSlides = sqliteTable('site_hero_slides', {
  id: text('id').primaryKey(),
  placement: text('placement').notNull().default('home'),
  landscapeAssetId: text('landscape_asset_id').notNull()
    .references(() => assets.id),
  portraitAssetId: text('portrait_asset_id').notNull()
    .references(() => assets.id),
  altText: text('alt_text').notNull(),
  sortOrder: integer('sort_order').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  linkedWorkId: text('linked_work_id')
    .references(() => works.id, { onDelete: 'set null' }),
  landscapePreviewObjectKey: text('landscape_preview_object_key'),
  portraitPreviewObjectKey: text('portrait_preview_object_key'),
  previewExpiresAt: integer('preview_expires_at'),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  uniqueIndex('site_hero_slides_enabled_sort_unique')
    .on(table.placement, table.sortOrder)
    .where(sql`${table.enabled} = 1`),
  check(
    'site_hero_slides_placement',
    sql`${table.placement} IN ('home', 'commission')`,
  ),
  check(
    'site_hero_slides_pair_distinct',
    sql`${table.landscapeAssetId} != ${table.portraitAssetId}`,
  ),
  check(
    'site_hero_slides_alt_nonempty',
    sql`${table.altText} = trim(${table.altText}) AND length(${table.altText}) BETWEEN 1 AND 500`,
  ),
  check(
    'site_hero_slides_sort',
    sql`${table.sortOrder} >= 0 AND (${table.enabled} = 0 OR ${table.sortOrder} <= 4)`,
  ),
  check('site_hero_slides_version_positive', sql`${table.version} > 0`),
])

export const watermarkOperations = sqliteTable('watermark_operations', {
  id: text('id').primaryKey(),
  operationType: text('operation_type').notNull(),
  profileId: text('profile_id').notNull()
    .references(() => watermarkProfiles.id, { onDelete: 'restrict' }),
  brandingVersion: integer('branding_version').notNull(),
  status: text('status').notNull(),
  affectedWorkCount: integer('affected_work_count').notNull().default(0),
  affectedHeroSlideCount: integer('affected_hero_slide_count').notNull().default(0),
  targetVariantCount: integer('target_variant_count').notNull().default(0),
  generatedVariantCount: integer('generated_variant_count').notNull().default(0),
  verifiedVariantCount: integer('verified_variant_count').notNull().default(0),
  previewManifestJson: text('preview_manifest_json').notNull().default('[]'),
  cleanupObjectKeysJson: text('cleanup_object_keys_json').notNull().default('[]'),
  internalErrorCode: text('internal_error_code'),
  failureStage: text('failure_stage'),
  version: integer('version').notNull().default(1),
  // T34-F5 恢复基础设施：attempt/lease/heartbeat 由迁移 0020 增加。
  attempt: integer('attempt').notNull().default(0),
  leaseOwner: text('lease_owner'),
  leaseExpiresAt: integer('lease_expires_at'),
  heartbeatAt: integer('heartbeat_at'),
  recoveryReason: text('recovery_reason'),
  nextRetryAt: integer('next_retry_at'),
  startedAt: integer('started_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
}, table => [
  index('watermark_operations_profile_idx')
    .on(table.profileId, table.startedAt),
  index('watermark_operations_lease_idx')
    .on(table.status, table.leaseExpiresAt),
  check('watermark_operations_attempt', sql`${table.attempt} >= 0`),
  check(
    'watermark_operations_lease_owner',
    sql`${table.leaseOwner} IS NULL OR length(trim(${table.leaseOwner})) BETWEEN 1 AND 200`,
  ),
  check(
    'watermark_operations_recovery_reason',
    sql`${table.recoveryReason} IS NULL OR ${table.recoveryReason} IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')`,
  ),
  check(
    'watermark_operations_type',
    sql`${table.operationType} IN ('WATERMARK_PREVIEW', 'WATERMARK_REBUILD')`,
  ),
  check(
    'watermark_operations_status',
    sql`${table.status} IN ('GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'SWITCHING_PROFILE', 'CLEANING_PUBLIC', 'FAILED', 'DONE')`,
  ),
  check(
    'watermark_operations_counts',
    sql`${table.brandingVersion} >= 0 AND ${table.affectedWorkCount} >= 0 AND ${table.affectedHeroSlideCount} >= 0 AND ${table.targetVariantCount} >= 0 AND ${table.generatedVariantCount} >= 0 AND ${table.verifiedVariantCount} >= 0`,
  ),
  check(
    'watermark_operations_failure_state',
    sql`(${table.status} = 'FAILED' AND ${table.internalErrorCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.internalErrorCode} IS NULL AND ${table.failureStage} IS NULL)`,
  ),
  check('watermark_operations_version_positive', sql`${table.version} > 0`),
])

export const siteBranding = sqliteTable('site_branding', {
  id: text('id').primaryKey().default('site'),
  activeWatermarkProfileId: text('active_watermark_profile_id')
    .references(() => watermarkProfiles.id, { onDelete: 'restrict' }),
  draftWatermarkProfileId: text('draft_watermark_profile_id')
    .references(() => watermarkProfiles.id, { onDelete: 'restrict' }),
  lastWatermarkOperationId: text('last_watermark_operation_id')
    .references(() => watermarkOperations.id, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  check('site_branding_singleton', sql`${table.id} = 'site'`),
  check(
    'site_branding_profile_distinct',
    sql`${table.activeWatermarkProfileId} IS NULL OR ${table.draftWatermarkProfileId} IS NULL OR ${table.activeWatermarkProfileId} != ${table.draftWatermarkProfileId}`,
  ),
  check('site_branding_version_positive', sql`${table.version} > 0`),
])

export const publicationOperations = sqliteTable('publication_operations', {
  id: text('id').primaryKey(),
  operationType: text('operation_type').notNull().default('PUBLISH'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  requestedVersion: integer('requested_version').notNull(),
  status: text('status').notNull(),
  cleanupObjectKeysJson: text('cleanup_object_keys_json').notNull().default('[]'),
  edgePurgeUrlsJson: text('edge_purge_urls_json').notNull().default('[]'),
  edgePurgeTaskId: text('edge_purge_task_id'),
  edgePurgeStatus: text('edge_purge_status').notNull().default('NOT_REQUIRED'),
  edgePurgeReason: text('edge_purge_reason'),
  edgePurgeCheckedAt: integer('edge_purge_checked_at'),
  internalErrorCode: text('internal_error_code'),
  internalErrorMessage: text('internal_error_message'),
  failureStage: text('failure_stage'),
  version: integer('version').notNull().default(1),
  // T34-F5 恢复基础设施：attempt/lease/heartbeat 由迁移 0020 增加。
  attempt: integer('attempt').notNull().default(0),
  leaseOwner: text('lease_owner'),
  leaseExpiresAt: integer('lease_expires_at'),
  heartbeatAt: integer('heartbeat_at'),
  recoveryReason: text('recovery_reason'),
  nextRetryAt: integer('next_retry_at'),
  startedAt: integer('started_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
}, table => [
  index('publication_operations_entity_idx')
    .on(table.entityType, table.entityId, table.startedAt),
  index('publication_operations_lease_idx')
    .on(table.status, table.leaseExpiresAt),
  index('publication_operations_edge_purge_idx')
    .on(table.edgePurgeStatus, table.updatedAt),
  check('publication_operations_attempt', sql`${table.attempt} >= 0`),
  check(
    'publication_operations_lease_owner',
    sql`${table.leaseOwner} IS NULL OR length(trim(${table.leaseOwner})) BETWEEN 1 AND 200`,
  ),
  check(
    'publication_operations_recovery_reason',
    sql`${table.recoveryReason} IS NULL OR ${table.recoveryReason} IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')`,
  ),
  check(
    'publication_operations_operation_type',
    sql`${table.operationType} IN ('PUBLISH', 'UNPUBLISH', 'UPSCALE')`,
  ),
  check(
    'publication_operations_entity_type',
    sql`${table.entityType} IN ('WORK', 'HOME', 'RETURN_PHOTO')`,
  ),
  check(
    'publication_operations_status',
    sql`${table.status} IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')`,
  ),
  check(
    'publication_operations_requested_version',
    sql`${table.requestedVersion} > 0`,
  ),
  check(
    'publication_operations_failure_stage',
    sql`${table.failureStage} IS NULL OR ${table.failureStage} IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')`,
  ),
  check(
    'publication_operations_failure_state',
    sql`(${table.status} = 'FAILED' AND ${table.internalErrorCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.internalErrorCode} IS NULL AND ${table.failureStage} IS NULL)`,
  ),
  check(
    'publication_operations_edge_purge_status',
    sql`${table.edgePurgeStatus} IN ('NOT_REQUIRED', 'PENDING', 'PURGING', 'COMPLETE', 'FAILED')`,
  ),
  check('publication_operations_version_positive', sql`${table.version} > 0`),
])

export const businessStatuses = sqliteTable('business_statuses', {
  kind: text('kind').primaryKey(),
  tone: text('tone').notNull(),
  label: text('label').notNull(),
  detail: text('detail').notNull(),
  href: text('href').notNull(),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  check(
    'business_statuses_kind',
    sql`${table.kind} IN ('commission', 'adoption')`,
  ),
  check(
    'business_statuses_tone',
    sql`${table.tone} IN ('open', 'limited', 'closed')`,
  ),
  check(
    'business_statuses_text',
    sql`length(trim(${table.label})) > 0 AND length(trim(${table.detail})) > 0`,
  ),
  check(
    'business_statuses_href',
    sql`(${table.kind} = 'commission' AND ${table.href} = '/commission') OR (${table.kind} = 'adoption' AND ${table.href} = '/adoptions')`,
  ),
  check('business_statuses_version_positive', sql`${table.version} > 0`),
])

export const siteContent = sqliteTable('site_content', {
  id: text('id').primaryKey().default('site'),
  heroTagline: text('hero_tagline'),
  contactEmail: text('contact_email'),
  contactQq: text('contact_qq'),
  contactDouyin: text('contact_douyin'),
  officialChannelsJson: text('official_channels_json').notNull().default('[{"platform":"qq","account":null,"qrCodeAssetId":null},{"platform":"douyin","account":null,"qrCodeAssetId":null},{"platform":"qq_group","account":null,"qrCodeAssetId":null},{"platform":"xiaohongshu","account":null,"qrCodeAssetId":null},{"platform":"bilibili","account":null,"qrCodeAssetId":null}]'),
  commissionIntro: text('commission_intro'),
  commissionEstimateNote: text('commission_estimate_note'),
  commissionEmailAction: text('commission_email_action'),
  commissionFaqJson: text('commission_faq_json'),
  aboutStudioFacts: text('about_studio_facts'),
  aboutMakingScope: text('about_making_scope'),
  basicTerms: text('basic_terms'),
  privacyPolicy: text('privacy_policy'),
  contactAntiScam: text('contact_anti_scam'),
  heroAutoRotate: integer('hero_auto_rotate', { mode: 'boolean' })
    .notNull().default(false),
  heroAutoRotateIntervalMs: integer('hero_auto_rotate_interval_ms')
    .notNull().default(6_000),
  version: integer('version').notNull().default(1),
  // T34-F3：每个文案分区独立并发域，首屏 Hero 的 version 不再承担全部文案。
  commissionContentVersion: integer('commission_content_version')
    .notNull().default(1),
  commissionFaqVersion: integer('commission_faq_version')
    .notNull().default(1),
  aboutContentVersion: integer('about_content_version')
    .notNull().default(1),
  termsContentVersion: integer('terms_content_version')
    .notNull().default(1),
  privacyContentVersion: integer('privacy_content_version')
    .notNull().default(1),
  contactContentVersion: integer('contact_content_version')
    .notNull().default(1),
  ...timestampColumns(),
}, table => [
  check('site_content_singleton', sql`${table.id} = 'site'`),
  check(
    'site_content_section_versions_positive',
    sql`${table.commissionContentVersion} > 0 AND ${table.commissionFaqVersion} > 0 AND ${table.aboutContentVersion} > 0 AND ${table.termsContentVersion} > 0 AND ${table.privacyContentVersion} > 0 AND ${table.contactContentVersion} > 0`,
  ),
  check(
    'site_content_tagline',
    sql`${table.heroTagline} IS NULL OR (length(trim(${table.heroTagline})) BETWEEN 1 AND 120)`,
  ),
  check(
    'site_content_rotation_interval',
    sql`${table.heroAutoRotateIntervalMs} >= 6000`,
  ),
  check(
    'site_content_commission_intro',
    sql`${table.commissionIntro} IS NULL OR (length(trim(${table.commissionIntro})) BETWEEN 1 AND 240 AND ${table.commissionIntro} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_contact_douyin',
    sql`${table.contactDouyin} IS NULL OR (${table.contactDouyin} = trim(${table.contactDouyin}) AND length(${table.contactDouyin}) BETWEEN 2 AND 30 AND ${table.contactDouyin} NOT GLOB '*[ <>]*')`,
  ),
  check(
    'site_content_official_channels_json',
    sql`json_valid(${table.officialChannelsJson}) AND json_type(${table.officialChannelsJson}) = 'array' AND json_array_length(${table.officialChannelsJson}) = 5 AND json_extract(${table.officialChannelsJson}, '$[0].platform') = 'qq' AND json_extract(${table.officialChannelsJson}, '$[1].platform') = 'douyin' AND json_extract(${table.officialChannelsJson}, '$[2].platform') = 'qq_group' AND json_extract(${table.officialChannelsJson}, '$[3].platform') = 'xiaohongshu' AND json_extract(${table.officialChannelsJson}, '$[4].platform') = 'bilibili' AND length(${table.officialChannelsJson}) <= 5000`,
  ),
  check(
    'site_content_commission_estimate_note',
    sql`${table.commissionEstimateNote} IS NULL OR (length(trim(${table.commissionEstimateNote})) BETWEEN 1 AND 600 AND ${table.commissionEstimateNote} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_commission_email_action',
    sql`${table.commissionEmailAction} IS NULL OR (length(trim(${table.commissionEmailAction})) BETWEEN 1 AND 240 AND ${table.commissionEmailAction} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_commission_faq_json',
    sql`${table.commissionFaqJson} IS NULL OR (json_valid(${table.commissionFaqJson}) AND json_type(${table.commissionFaqJson}) = 'array' AND length(${table.commissionFaqJson}) <= 12000)`,
  ),
  check(
    'site_content_about_studio_facts',
    sql`${table.aboutStudioFacts} IS NULL OR (length(trim(${table.aboutStudioFacts})) BETWEEN 1 AND 1200 AND ${table.aboutStudioFacts} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_about_making_scope',
    sql`${table.aboutMakingScope} IS NULL OR (length(trim(${table.aboutMakingScope})) BETWEEN 1 AND 1200 AND ${table.aboutMakingScope} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_basic_terms',
    sql`${table.basicTerms} IS NULL OR (length(trim(${table.basicTerms})) BETWEEN 1 AND 8000 AND ${table.basicTerms} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_privacy_policy',
    sql`${table.privacyPolicy} IS NULL OR (length(trim(${table.privacyPolicy})) BETWEEN 1 AND 8000 AND ${table.privacyPolicy} NOT GLOB '*[<>]*')`,
  ),
  check(
    'site_content_contact_anti_scam',
    sql`${table.contactAntiScam} IS NULL OR (length(trim(${table.contactAntiScam})) BETWEEN 1 AND 600 AND ${table.contactAntiScam} NOT GLOB '*[<>]*')`,
  ),
  check('site_content_version_positive', sql`${table.version} > 0`),
])

/**
 * T34-F1 既有站点展示素材 reconcile 的持久 operation（迁移 0021）。
 * 与 publication_operations 分表，但共用同一组 lease/heartbeat 列，
 * 因此复用 operation-lease 的抢占、心跳和恢复语句。
 */
export const siteDisplayReconcileOperations = sqliteTable(
  'site_display_reconcile_operations',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull().default('all'),
    status: text('status').notNull(),
    scannedCount: integer('scanned_count').notNull().default(0),
    generatedCount: integer('generated_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    cleanupObjectKeysJson: text('cleanup_object_keys_json').notNull().default('[]'),
    internalErrorCode: text('internal_error_code'),
    failureStage: text('failure_stage'),
    version: integer('version').notNull().default(1),
    attempt: integer('attempt').notNull().default(0),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: integer('lease_expires_at'),
    heartbeatAt: integer('heartbeat_at'),
    recoveryReason: text('recovery_reason'),
    nextRetryAt: integer('next_retry_at'),
    startedAt: integer('started_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    completedAt: integer('completed_at'),
  },
  table => [
    index('site_display_reconcile_started_idx').on(table.startedAt),
    index('site_display_reconcile_lease_idx')
      .on(table.status, table.leaseExpiresAt),
    uniqueIndex('site_display_reconcile_single_active')
      .on(table.scope)
      .where(sql`${table.status} NOT IN ('FAILED', 'DONE')`),
    check(
      'site_display_reconcile_scope',
      sql`${table.scope} IN ('all', 'home-hero', 'commission-hero', 'home-entry')`,
    ),
    check(
      'site_display_reconcile_status',
      sql`${table.status} IN ('SCANNING', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'CLEANING_PUBLIC', 'FAILED', 'DONE')`,
    ),
    check(
      'site_display_reconcile_counts',
      sql`${table.scannedCount} >= 0 AND ${table.generatedCount} >= 0 AND ${table.skippedCount} >= 0 AND ${table.failedCount} >= 0`,
    ),
    check(
      'site_display_reconcile_failure_state',
      sql`(${table.status} = 'FAILED' AND ${table.internalErrorCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.internalErrorCode} IS NULL AND ${table.failureStage} IS NULL)`,
    ),
    check('site_display_reconcile_version_positive', sql`${table.version} > 0`),
    check('site_display_reconcile_attempt', sql`${table.attempt} >= 0`),
    check(
      'site_display_reconcile_lease_owner',
      sql`${table.leaseOwner} IS NULL OR length(trim(${table.leaseOwner})) BETWEEN 1 AND 200`,
    ),
    check(
      'site_display_reconcile_recovery_reason',
      sql`${table.recoveryReason} IS NULL OR ${table.recoveryReason} IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')`,
    ),
  ],
)

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  result: text('result').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [
  index('audit_logs_created_idx').on(table.createdAt),
  check('audit_logs_action_nonempty', sql`length(trim(${table.action})) > 0`),
  check(
    'audit_logs_entity_type_nonempty',
    sql`length(trim(${table.entityType})) > 0`,
  ),
  check(
    'audit_logs_result',
    sql`${table.result} IN ('SUCCESS', 'FAILURE')`,
  ),
])
