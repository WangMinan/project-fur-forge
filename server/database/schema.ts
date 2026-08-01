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
  currentEventName: text('current_event_name'),
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
    sql`(${table.purpose} = 'adoption') OR (${table.adoptionMethod} IS NULL AND ${table.businessStatus} IS NULL AND ${table.currentEventName} IS NULL AND ${table.priceAmountMinor} IS NULL AND ${table.priceCurrency} IS NULL)`,
  ),
  check(
    'works_business_status',
    sql`${table.businessStatus} IS NULL OR ${table.businessStatus} IN ('preparing', 'available', 'event_sale', 'scheduled', 'in_production', 'delivered')`,
  ),
  check(
    'works_event_sale',
    sql`${table.businessStatus} != 'event_sale' OR (${table.adoptionMethod} = 'event_drop' AND length(trim(${table.currentEventName})) > 0)`,
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
    sql`${table.role} IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo')`,
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
}, table => [
  uniqueIndex('upload_sessions_private_object_key_unique')
    .on(table.privateObjectKey),
  index('upload_sessions_owner_idx')
    .on(table.ownerType, table.ownerId, table.createdAt),
  index('upload_sessions_expiry_idx')
    .on(table.status, table.expiresAt),
  check(
    'upload_sessions_owner_type',
    sql`${table.ownerType} IN ('work', 'site')`,
  ),
  check(
    'upload_sessions_owner_id',
    sql`length(trim(${table.ownerId})) > 0 AND (${table.ownerType} != 'site' OR ${table.ownerId} IN ('home', 'branding'))`,
  ),
  check(
    'upload_sessions_owner_version',
    sql`${table.ownerVersion} >= 0`,
  ),
  check(
    'upload_sessions_media_role',
    sql`(${table.ownerType} = 'work' AND ${table.mediaRole} IN ('design_sheet', 'studio_photo')) OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'home' AND ${table.mediaRole} IN ('home_hero_landscape', 'home_hero_portrait')) OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'branding' AND ${table.mediaRole} = 'watermark_logo')`,
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
    sql`${table.mediaRole} IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')`,
  ),
  check(
    'asset_variants_usage',
    sql`${table.usage} IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait')`,
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
    'asset_variants_public_watermark',
    sql`${table.storageScope} != 'PUBLIC' OR ((${table.watermarkProfile} = 'brand-standard-v1' AND ${table.watermarkProfileId} IS NULL AND ${table.watermarkConfigDigest} = 'none' AND ${table.logoDigest} != 'none' AND ${table.watermarkAnchor} IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND ${table.watermarkOpacityPercent} IS NULL AND ${table.watermarkScalePercent} IS NULL) OR (${table.watermarkProfile} = 'brand-centered-v2' AND ${table.watermarkProfileId} IS NOT NULL AND ${table.watermarkConfigDigest} != 'none' AND ${table.logoDigest} != 'none' AND ${table.watermarkAnchor} = 'center' AND ${table.watermarkOpacityPercent} BETWEEN 10 AND 90 AND ${table.watermarkScalePercent} BETWEEN 20 AND 90))`,
  ),
  check(
    'asset_variants_preprocess_private',
    sql`${table.usage} != 'preprocess' OR (${table.storageScope} = 'PRIVATE' AND ${table.watermarkProfile} = 'none' AND ${table.watermarkProfileId} IS NULL AND ${table.watermarkConfigDigest} = 'none' AND ${table.logoDigest} = 'none' AND ${table.watermarkAnchor} = 'none' AND ${table.watermarkOpacityPercent} IS NULL AND ${table.watermarkScalePercent} IS NULL)`,
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

export const siteHeroSlides = sqliteTable('site_hero_slides', {
  id: text('id').primaryKey(),
  landscapeAssetId: text('landscape_asset_id').notNull()
    .references(() => assets.id),
  portraitAssetId: text('portrait_asset_id').notNull()
    .references(() => assets.id),
  altText: text('alt_text').notNull(),
  sortOrder: integer('sort_order').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  linkedWorkId: text('linked_work_id')
    .references(() => works.id, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  uniqueIndex('site_hero_slides_enabled_sort_unique')
    .on(table.sortOrder)
    .where(sql`${table.enabled} = 1`),
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
  startedAt: integer('started_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
}, table => [
  index('watermark_operations_profile_idx')
    .on(table.profileId, table.startedAt),
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
  internalErrorCode: text('internal_error_code'),
  internalErrorMessage: text('internal_error_message'),
  failureStage: text('failure_stage'),
  version: integer('version').notNull().default(1),
  startedAt: integer('started_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  completedAt: integer('completed_at'),
}, table => [
  index('publication_operations_entity_idx')
    .on(table.entityType, table.entityId, table.startedAt),
  check(
    'publication_operations_operation_type',
    sql`${table.operationType} IN ('PUBLISH', 'UNPUBLISH')`,
  ),
  check(
    'publication_operations_entity_type',
    sql`${table.entityType} IN ('WORK', 'HOME')`,
  ),
  check(
    'publication_operations_status',
    sql`${table.status} IN ('GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')`,
  ),
  check(
    'publication_operations_requested_version',
    sql`${table.requestedVersion} > 0`,
  ),
  check(
    'publication_operations_failure_stage',
    sql`${table.failureStage} IS NULL OR ${table.failureStage} IN ('VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')`,
  ),
  check(
    'publication_operations_failure_state',
    sql`(${table.status} = 'FAILED' AND ${table.internalErrorCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.internalErrorCode} IS NULL AND ${table.failureStage} IS NULL)`,
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
    sql`${table.href} IN ('/commission', '/adoptions')`,
  ),
])

export const siteContent = sqliteTable('site_content', {
  id: text('id').primaryKey().default('site'),
  heroTagline: text('hero_tagline'),
  heroAutoRotate: integer('hero_auto_rotate', { mode: 'boolean' })
    .notNull().default(false),
  heroAutoRotateIntervalMs: integer('hero_auto_rotate_interval_ms')
    .notNull().default(6_000),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  check('site_content_singleton', sql`${table.id} = 'site'`),
  check(
    'site_content_tagline',
    sql`${table.heroTagline} IS NULL OR (length(trim(${table.heroTagline})) BETWEEN 1 AND 120)`,
  ),
  check(
    'site_content_rotation_interval',
    sql`${table.heroAutoRotateIntervalMs} >= 6000`,
  ),
  check('site_content_version_positive', sql`${table.version} > 0`),
])

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
