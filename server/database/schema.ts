import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
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
  purpose: text('purpose').notNull(),
  adoptionStatus: text('adoption_status'),
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
  check(
    'works_purpose',
    sql`${table.purpose} IN ('commission', 'adoption', 'showcase')`,
  ),
  check(
    'works_adoption_fields',
    sql`(${table.purpose} = 'adoption' AND ${table.adoptionStatus} IS NOT NULL AND ${table.adoptionStatus} IN ('available', 'adopted')) OR (${table.purpose} != 'adoption' AND ${table.adoptionStatus} IS NULL AND ${table.priceAmountMinor} IS NULL AND ${table.priceCurrency} IS NULL)`,
  ),
  check(
    'works_adoption_status',
    sql`${table.adoptionStatus} IS NULL OR ${table.adoptionStatus} IN ('available', 'adopted')`,
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
  version: integer('version').notNull().default(1),
  internalErrorCode: text('internal_error_code'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('assets_private_object_key_unique')
    .on(table.privateObjectKey),
  check(
    'assets_role',
    sql`${table.role} IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')`,
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
    'assets_hero_orientation',
    sql`(${table.role} != 'home_hero_landscape' OR ${table.width} > ${table.height}) AND (${table.role} != 'home_hero_portrait' OR ${table.height} > ${table.width})`,
  ),
  check(
    'assets_adoption_cover_landscape',
    sql`${table.role} != 'adoption_cover' OR ${table.width} > ${table.height}`,
  ),
  check(
    'assets_commission_reference_private_source',
    sql`${table.role} != 'commission_design_reference' OR ${table.byteSize} <= 20000000`,
  ),
  check(
    'assets_mime_type',
    sql`${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`,
  ),
  check(
    'assets_contact_qr_source',
    sql`${table.role} != 'contact_qr' OR (${table.mimeType} IN ('image/jpeg', 'image/png', 'image/webp') AND ${table.byteSize} <= 20000000 AND ${table.width} >= 64 AND ${table.height} >= 64 AND ${table.fitMode} = 'contain')`,
  ),
  check('assets_version_positive', sql`${table.version} > 0`),
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
    sql`${table.ownerType} IN ('work', 'site')`,
  ),
  check(
    'upload_sessions_owner_id',
    sql`length(trim(${table.ownerId})) > 0 AND (${table.ownerType} != 'site' OR ${table.ownerId} IN ('hero-home-landscape', 'hero-home-portrait', 'hero-commission-landscape', 'hero-commission-portrait', 'contact'))`,
  ),
  check(
    'upload_sessions_owner_version',
    sql`${table.ownerVersion} >= 0`,
  ),
  check(
    'upload_sessions_media_role',
    sql`(${table.ownerType} = 'work' AND ${table.mediaRole} IN ('design_sheet', 'studio_photo', 'adoption_cover')) OR (${table.ownerType} = 'site' AND ${table.ownerId} IN ('hero-home-landscape', 'hero-commission-landscape') AND ${table.mediaRole} = 'home_hero_landscape') OR (${table.ownerType} = 'site' AND ${table.ownerId} IN ('hero-home-portrait', 'hero-commission-portrait') AND ${table.mediaRole} = 'home_hero_portrait') OR (${table.ownerType} = 'site' AND ${table.ownerId} = 'contact' AND ${table.mediaRole} = 'contact_qr')`,
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
    'upload_sessions_contact_qr_source',
    sql`${table.mediaRole} != 'contact_qr' OR (${table.expectedContentType} IN ('image/jpeg', 'image/png', 'image/webp') AND ${table.expectedBytes} <= 20000000 AND ${table.expectedWidth} >= 64 AND ${table.expectedHeight} >= 64)`,
  ),
  check(
    'upload_sessions_adoption_cover_landscape',
    sql`${table.mediaRole} != 'adoption_cover' OR ${table.expectedWidth} > ${table.expectedHeight}`,
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

/** R3-B: anonymous commission uploads stay isolated from administrator sessions. */
export const commissionUploadSessions = sqliteTable('commission_upload_sessions', {
  id: text('id').primaryKey(),
  tokenDigest: text('token_digest').notNull(),
  privateObjectKey: text('private_object_key').notNull(),
  expectedContentType: text('expected_content_type').notNull(),
  expectedBytes: integer('expected_bytes').notNull(),
  expectedContentMd5: text('expected_content_md5').notNull(),
  expectedSha256: text('expected_sha256').notNull(),
  expectedWidth: integer('expected_width').notNull(),
  expectedHeight: integer('expected_height').notNull(),
  status: text('status').notNull().default('AWAITING_UPLOAD'),
  assetId: text('asset_id').references(() => assets.id, { onDelete: 'restrict' }),
  failureCode: text('failure_code'),
  failureStage: text('failure_stage'),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  completedAt: integer('completed_at'),
  consumedAt: integer('consumed_at'),
  updatedAt: integer('updated_at').notNull(),
}, table => [
  uniqueIndex('commission_upload_sessions_token_unique').on(table.tokenDigest),
  uniqueIndex('commission_upload_sessions_key_unique').on(table.privateObjectKey),
  uniqueIndex('commission_upload_sessions_asset_unique')
    .on(table.assetId).where(sql`${table.assetId} IS NOT NULL`),
  index('commission_upload_sessions_expiry_idx').on(table.status, table.expiresAt),
  check(
    'commission_upload_sessions_token_digest',
    sql`length(${table.tokenDigest}) = 64 AND ${table.tokenDigest} = lower(${table.tokenDigest}) AND ${table.tokenDigest} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'commission_upload_sessions_key_relative',
    sql`length(trim(${table.privateObjectKey})) > 0 AND instr(${table.privateObjectKey}, '://') = 0 AND substr(${table.privateObjectKey}, 1, 1) != '/'`,
  ),
  check(
    'commission_upload_sessions_content_type',
    sql`${table.expectedContentType} IN ('image/jpeg', 'image/png', 'image/webp')`,
  ),
  check(
    'commission_upload_sessions_expected_bytes',
    sql`${table.expectedBytes} BETWEEN 1 AND 20000000`,
  ),
  check('commission_upload_sessions_expected_md5', sql`length(${table.expectedContentMd5}) = 24`),
  check(
    'commission_upload_sessions_expected_sha256',
    sql`length(${table.expectedSha256}) = 64 AND ${table.expectedSha256} = lower(${table.expectedSha256}) AND ${table.expectedSha256} NOT GLOB '*[^0-9a-f]*'`,
  ),
  check(
    'commission_upload_sessions_dimensions',
    sql`${table.expectedWidth} BETWEEN 64 AND 12000 AND ${table.expectedHeight} BETWEEN 64 AND 12000`,
  ),
  check(
    'commission_upload_sessions_status',
    sql`${table.status} IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'CONSUMED', 'FAILED', 'CANCELLED', 'EXPIRED')`,
  ),
  check(
    'commission_upload_sessions_asset_state',
    sql`(${table.status} IN ('COMPLETED', 'CONSUMED') AND ${table.assetId} IS NOT NULL) OR (${table.status} NOT IN ('COMPLETED', 'CONSUMED') AND ${table.assetId} IS NULL)`,
  ),
  check(
    'commission_upload_sessions_failure_state',
    sql`(${table.status} = 'FAILED' AND ${table.failureCode} IS NOT NULL AND ${table.failureStage} IS NOT NULL) OR (${table.status} != 'FAILED' AND ${table.failureCode} IS NULL AND ${table.failureStage} IS NULL)`,
  ),
  check(
    'commission_upload_sessions_failure_stage',
    sql`${table.failureStage} IS NULL OR ${table.failureStage} IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')`,
  ),
  check(
    'commission_upload_sessions_ttl',
    sql`${table.expiresAt} > ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + 600000`,
  ),
  check(
    'commission_upload_sessions_times',
    sql`(${table.status} IN ('COMPLETED', 'CONSUMED')) = (${table.completedAt} IS NOT NULL) AND (${table.status} = 'CONSUMED') = (${table.consumedAt} IS NOT NULL)`,
  ),
  check('commission_upload_sessions_version_positive', sql`${table.version} > 0`),
])

export const commissionSubmissions = sqliteTable('commission_submissions', {
  id: text('id').primaryKey(),
  receiptCode: text('receipt_code').notNull(),
  nickname: text('nickname').notNull(),
  // 0042 以前的真实申请无法由 Agent 猜测物种，因此旧行允许 NULL；
  // 所有新投递由请求 Schema 强制填写。
  species: text('species'),
  phoneCountryCode: text('phone_country_code').notNull().default('+86'),
  phoneNumber: text('phone_number').notNull(),
  qq: text('qq').notNull(),
  heightCm: integer('height_cm').notNull(),
  weightKgTenths: integer('weight_kg_tenths').notNull(),
  designAssetId: text('design_asset_id').notNull()
    .references(() => assets.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('pending'),
  internalNote: text('internal_note'),
  handledAt: integer('handled_at'),
  handledBy: text('handled_by').references(() => users.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  uniqueIndex('commission_submissions_receipt_unique').on(table.receiptCode),
  uniqueIndex('commission_submissions_design_asset_unique').on(table.designAssetId),
  uniqueIndex('commission_submissions_pending_phone_unique')
    .on(table.phoneCountryCode, table.phoneNumber)
    .where(sql`${table.status} = 'pending'`),
  index('commission_submissions_status_created_idx').on(table.status, table.createdAt),
  check(
    'commission_submissions_receipt',
    sql`${table.receiptCode} = upper(${table.receiptCode}) AND length(${table.receiptCode}) BETWEEN 8 AND 24 AND ${table.receiptCode} NOT GLOB '*[^A-Z0-9-]*'`,
  ),
  check(
    'commission_submissions_nickname',
    sql`${table.nickname} = trim(${table.nickname}) AND length(${table.nickname}) BETWEEN 1 AND 50`,
  ),
  check(
    'commission_submissions_species',
    sql`${table.species} IS NULL OR (${table.species} = trim(${table.species}) AND length(${table.species}) BETWEEN 1 AND 50 AND ${table.species} NOT GLOB '*[<>]*')`,
  ),
  check('commission_submissions_country', sql`${table.phoneCountryCode} = '+86'`),
  check(
    'commission_submissions_phone',
    sql`length(${table.phoneNumber}) = 11 AND ${table.phoneNumber} GLOB '1[3-9]*' AND ${table.phoneNumber} NOT GLOB '*[^0-9]*'`,
  ),
  check(
    'commission_submissions_qq',
    sql`substr(${table.qq}, 1, 1) BETWEEN '1' AND '9' AND length(${table.qq}) BETWEEN 5 AND 12 AND ${table.qq} NOT GLOB '*[^0-9]*'`,
  ),
  check('commission_submissions_height', sql`${table.heightCm} BETWEEN 80 AND 250`),
  check('commission_submissions_weight', sql`${table.weightKgTenths} BETWEEN 200 AND 3000`),
  check(
    'commission_submissions_status',
    sql`${table.status} IN ('pending', 'accepted', 'rejected')`,
  ),
  check(
    'commission_submissions_note',
    sql`${table.internalNote} IS NULL OR (${table.internalNote} = trim(${table.internalNote}) AND length(${table.internalNote}) BETWEEN 1 AND 2000)`,
  ),
  check(
    'commission_submissions_handled',
    sql`(${table.status} = 'pending' AND ${table.handledAt} IS NULL AND ${table.handledBy} IS NULL) OR (${table.status} IN ('accepted', 'rejected') AND ${table.handledAt} IS NOT NULL AND ${table.handledBy} IS NOT NULL)`,
  ),
  check('commission_submissions_version_positive', sql`${table.version} > 0`),
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
  sha256: text('sha256'),
  byteSize: integer('byte_size'),
  version: integer('version').notNull().default(1),
  internalErrorCode: text('internal_error_code'),
  ...timestampColumns(),
}, table => [
  uniqueIndex('asset_variants_object_key_unique').on(table.objectKey),
  uniqueIndex('asset_variants_identity_unique').on(
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
  ),
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
    sql`${table.mediaRole} IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')`,
  ),
  check(
    'asset_variants_usage',
    sql`${table.usage} IN ('preprocess', 'work-card', 'adoption-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'contact-qr')`,
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
    sql`length(trim(${table.cropIdentity})) > 0 AND length(trim(${table.recipeVersion})) > 0`,
  ),
  check(
    'asset_variants_site_display_recipe',
    sql`${table.recipeVersion} NOT IN ('site-display-v1', 'site-display-v2') OR (${table.storageScope} = 'PUBLIC' AND ${table.usage} IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))`,
  ),
  check(
    'asset_variants_site_display_usage',
    sql`${table.usage} NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (${table.storageScope} = 'PUBLIC' AND ${table.recipeVersion} IN ('site-display-v1', 'site-display-v2'))`,
  ),
  check(
    'asset_variants_commission_private',
    sql`${table.mediaRole} != 'commission_design_reference' OR ${table.storageScope} = 'PRIVATE'`,
  ),
  check(
    'asset_variants_contact_qr_recipe',
    sql`${table.recipeVersion} != 'contact-qr-v1' OR (${table.storageScope} = 'PUBLIC' AND ${table.usage} = 'contact-qr' AND ${table.mediaRole} = 'contact_qr' AND ${table.format} = 'png' AND ${table.width} = ${table.height})`,
  ),
  check(
    'asset_variants_contact_qr_usage',
    sql`${table.usage} != 'contact-qr' OR (${table.storageScope} = 'PUBLIC' AND ${table.recipeVersion} = 'contact-qr-v1' AND ${table.mediaRole} = 'contact_qr' AND ${table.format} = 'png' AND ${table.width} = ${table.height})`,
  ),
  check(
    'asset_variants_contact_qr_role',
    sql`${table.mediaRole} != 'contact_qr' OR ${table.usage} IN ('preprocess', 'contact-qr')`,
  ),
  check(
    'asset_variants_preprocess_private',
    sql`${table.usage} != 'preprocess' OR ${table.storageScope} = 'PRIVATE'`,
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
    sql`${table.role} IN ('design_sheet', 'studio_photo', 'adoption_cover')`,
  ),
  check(
    'work_assets_alt_text',
    sql`${table.altText} IS NULL OR (${table.altText} = trim(${table.altText}) AND length(${table.altText}) BETWEEN 1 AND 500)`,
  ),
  check(
    'work_assets_position',
    sql`(${table.role} IN ('design_sheet', 'adoption_cover') AND ${table.position} = 0) OR (${table.role} = 'studio_photo' AND ${table.position} BETWEEN 0 AND 4)`,
  ),
  check(
    'work_assets_primary',
    sql`${table.role} = 'studio_photo' OR ${table.primary} = 0`,
  ),
  check(
    'work_assets_focus',
    sql`${table.focalX} BETWEEN 0 AND 1 AND ${table.focalY} BETWEEN 0 AND 1`,
  ),
  check(
    'work_assets_crop',
    sql`${table.cropX} BETWEEN 0 AND 1 AND ${table.cropY} BETWEEN 0 AND 1 AND ${table.cropWidth} > 0 AND ${table.cropWidth} <= 1 AND ${table.cropHeight} > 0 AND ${table.cropHeight} <= 1 AND ${table.cropX} + ${table.cropWidth} <= 1 AND ${table.cropY} + ${table.cropHeight} <= 1`,
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
    sql`${table.routeKey} IN ('home', 'works', 'work_detail', 'commission', 'adoptions', 'about', 'service', 'privacy', 'licenses')`,
  ),
  check(
    'analytics_events_entity_type',
    sql`${table.entityType} IS NULL OR ${table.entityType} = 'work'`,
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
    sql`CASE WHEN ${table.eventType} = 'contact_action' THEN ${table.routeKey} IN ('about', 'commission') AND ${table.actionKey} IS NOT NULL AND ${table.entityType} IS NULL AND ${table.entityId} IS NULL WHEN ${table.routeKey} = 'work_detail' THEN ${table.entityType} = 'work' AND ${table.entityId} IS NOT NULL AND ${table.actionKey} IS NULL ELSE ${table.entityType} IS NULL AND ${table.entityId} IS NULL AND ${table.actionKey} IS NULL END`,
  ),
])

/** R3-B expand: four collection rows are independent optimistic-lock domains. */
export const siteHeroCollections = sqliteTable('site_hero_collections', {
  placement: text('placement').notNull(),
  orientation: text('orientation').notNull(),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  primaryKey({ columns: [table.placement, table.orientation] }),
  check(
    'site_hero_collections_placement',
    sql`${table.placement} IN ('home', 'commission')`,
  ),
  check(
    'site_hero_collections_orientation',
    sql`${table.orientation} IN ('landscape', 'portrait')`,
  ),
  check(
    'site_hero_collections_version_positive',
    sql`${table.version} > 0`,
  ),
])

/** R3-B expand: one orientation-specific item, with no linked-work field. */
export const siteHeroItems = sqliteTable('site_hero_items', {
  id: text('id').primaryKey(),
  placement: text('placement').notNull(),
  orientation: text('orientation').notNull(),
  assetId: text('asset_id').notNull()
    .references(() => assets.id, { onDelete: 'restrict' }),
  altText: text('alt_text').notNull(),
  sortOrder: integer('sort_order').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  previewObjectKey: text('preview_object_key'),
  previewExpiresAt: integer('preview_expires_at'),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  foreignKey({
    columns: [table.placement, table.orientation],
    foreignColumns: [siteHeroCollections.placement, siteHeroCollections.orientation],
  }).onDelete('restrict'),
  uniqueIndex('site_hero_items_enabled_sort_unique')
    .on(table.placement, table.orientation, table.sortOrder)
    .where(sql`${table.enabled} = 1`),
  index('site_hero_items_collection_idx')
    .on(table.placement, table.orientation, table.enabled, table.sortOrder),
  index('site_hero_items_asset_idx').on(table.assetId),
  check(
    'site_hero_items_placement',
    sql`${table.placement} IN ('home', 'commission')`,
  ),
  check(
    'site_hero_items_orientation',
    sql`${table.orientation} IN ('landscape', 'portrait')`,
  ),
  check(
    'site_hero_items_alt_nonempty',
    sql`${table.altText} = trim(${table.altText}) AND length(${table.altText}) BETWEEN 1 AND 500`,
  ),
  check(
    'site_hero_items_sort',
    sql`${table.sortOrder} >= 0 AND (${table.enabled} = 0 OR ${table.sortOrder} <= 4)`,
  ),
  check(
    'site_hero_items_preview_state',
    sql`(${table.previewObjectKey} IS NULL AND ${table.previewExpiresAt} IS NULL) OR (${table.previewObjectKey} IS NOT NULL AND ${table.previewExpiresAt} IS NOT NULL)`,
  ),
  check('site_hero_items_version_positive', sql`${table.version} > 0`),
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
    sql`${table.entityType} IN ('WORK', 'HOME')`,
  ),
  check(
    'publication_operations_status',
    sql`${table.status} IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')`,
  ),
  check(
    'publication_operations_requested_version',
    sql`${table.requestedVersion} > 0`,
  ),
  check(
    'publication_operations_failure_stage',
    sql`${table.failureStage} IS NULL OR ${table.failureStage} IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')`,
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
  href: text('href').notNull(),
  version: integer('version').notNull().default(1),
  ...timestampColumns(),
}, table => [
  check(
    'business_statuses_kind',
    sql`${table.kind} IN ('commission')`,
  ),
  check(
    'business_statuses_tone',
    sql`${table.tone} IN ('open', 'closed')`,
  ),
  check(
    'business_statuses_text',
    sql`length(trim(${table.label})) > 0`,
  ),
  check(
    'business_statuses_href',
    sql`${table.kind} = 'commission' AND ${table.href} = '/commission'`,
  ),
  check('business_statuses_version_positive', sql`${table.version} > 0`),
])

export const siteContent = sqliteTable('site_content', {
  id: text('id').primaryKey().default('site'),
  heroTagline: text('hero_tagline'),
  contactEmail: text('contact_email'),
  contactQq: text('contact_qq'),
  officialChannelsJson: text('official_channels_json').notNull().default('[{"platform":"qq","account":null,"qrCodeAssetId":null},{"platform":"qq_group","account":null,"qrCodeAssetId":null}]'),
  commissionIntro: text('commission_intro'),
  commissionEstimateNote: text('commission_estimate_note'),
  commissionEmailAction: text('commission_email_action'),
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
  // 每个现存文案分区独立并发域，首屏 Hero 的 version 不再承担全部文案。
  commissionContentVersion: integer('commission_content_version')
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
    sql`${table.commissionContentVersion} > 0 AND ${table.aboutContentVersion} > 0 AND ${table.termsContentVersion} > 0 AND ${table.privacyContentVersion} > 0 AND ${table.contactContentVersion} > 0`,
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
    'site_content_official_channels_json',
    sql`json_valid(${table.officialChannelsJson}) AND json_type(${table.officialChannelsJson}) = 'array' AND json_array_length(${table.officialChannelsJson}) = 2 AND json_extract(${table.officialChannelsJson}, '$[0].platform') = 'qq' AND json_extract(${table.officialChannelsJson}, '$[1].platform') = 'qq_group' AND length(${table.officialChannelsJson}) <= 2000`,
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
