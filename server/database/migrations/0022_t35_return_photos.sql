-- T35 返图领域模型：新增 return_photos，并为 return_photo 媒体角色、
-- return-wall 用途、return-display-v1 无水印配方与 RETURN_PHOTO operation 放开约束。
--
-- 只新增前向迁移；历史迁移未修改。SQLite 无法直接 ALTER CHECK，因此
-- assets / asset_variants / upload_sessions / publication_operations 采用
-- 与迁移 0017 相同的重建流程：建新表 → 复制 → 删旧表 → 改名 → 重建索引与触发器。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- 1. 先删除所有将被重建的表上的触发器，以及其他表上引用 assets 的触发器。
--    SQLite 在 ALTER TABLE RENAME 时重新解析整个 schema，任何仍然引用
--    已被 DROP 的表的触发器都会让改名失败，因此统一在重建前删除、重建后恢复。
DROP TRIGGER IF EXISTS `asset_variants_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_role_usage_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_watermark_profile_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_source_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preprocess_limit_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preserve_source`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_original_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `watermark_profiles_source_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_update`;--> statement-breakpoint
-- work_assets_role_immutable 本身不引用 assets，但它与 work_assets_role_update
-- 监听同一个 UPDATE OF role。SQLite 按创建顺序触发，因此必须一起重建，
-- 才能保持“先报 relation replacement”的既有报错顺序不变。
DROP TRIGGER IF EXISTS `work_assets_role_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `publication_operations_failure_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `publication_operations_failure_update`;--> statement-breakpoint
-- 2. 重建受影响的表并恢复索引。return_photos 在 upload_sessions 之前建立，
--    因为 upload_sessions_owner_insert 需要引用它。
CREATE TABLE `__new_asset_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`source_variant_id` text,
	`storage_scope` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`object_key` text NOT NULL,
	`input_sha256` text NOT NULL,
	`media_role` text NOT NULL,
	`usage` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text NOT NULL,
	`quality` integer NOT NULL,
	`crop_identity` text NOT NULL,
	`recipe_version` text NOT NULL,
	`protection_mode` text DEFAULT 'watermark' NOT NULL,
	`watermark_profile` text NOT NULL,
	`watermark_profile_id` text,
	`watermark_config_digest` text DEFAULT 'none' NOT NULL,
	`logo_digest` text NOT NULL,
	`watermark_anchor` text NOT NULL,
	`watermark_opacity_percent` integer,
	`watermark_scale_percent` integer,
	`sha256` text,
	`byte_size` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_variant_id`) REFERENCES `asset_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`watermark_profile_id`) REFERENCES `watermark_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "asset_variants_storage_scope" CHECK(`storage_scope` IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "asset_variants_status" CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "asset_variants_key_relative" CHECK(length(trim(`object_key`)) > 0 AND instr(`object_key`, '://') = 0 AND substr(`object_key`, 1, 1) != '/'),
	CONSTRAINT "asset_variants_input_sha256" CHECK(length(`input_sha256`) = 64 AND `input_sha256` = lower(`input_sha256`) AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "asset_variants_media_role" CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'return_photo')),
	CONSTRAINT "asset_variants_usage" CHECK(`usage` IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'return-wall')),
	CONSTRAINT "asset_variants_dimensions" CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK(`format` IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK(`quality` BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim(`crop_identity`)) > 0 AND length(trim(`recipe_version`)) > 0 AND length(trim(`watermark_profile`)) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK(`logo_digest` = 'none' OR (length(`logo_digest`) = 64 AND `logo_digest` = lower(`logo_digest`) AND `logo_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK(`watermark_anchor` IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
	CONSTRAINT "asset_variants_watermark_config_digest" CHECK(`watermark_config_digest` = 'none' OR (length(`watermark_config_digest`) = 64 AND `watermark_config_digest` = lower(`watermark_config_digest`) AND `watermark_config_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_protection_mode" CHECK(`protection_mode` IN ('none', 'watermark')),
	CONSTRAINT "asset_variants_unprotected_identity" CHECK(`protection_mode` != 'none' OR (`watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_site_display_recipe" CHECK(`recipe_version` != 'site-display-v1' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))),
	CONSTRAINT "asset_variants_site_display_usage" CHECK(`usage` NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` = 'site-display-v1')),
	CONSTRAINT "asset_variants_public_protection" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` = 'watermark' OR `recipe_version` IN ('site-display-v1', 'return-display-v1')),
	CONSTRAINT "asset_variants_return_display_recipe" CHECK(`recipe_version` != 'return-display-v1' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` = 'return-wall' AND `media_role` = 'return_photo')),
	CONSTRAINT "asset_variants_return_wall_usage" CHECK(`usage` != 'return-wall' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` = 'return-display-v1' AND `media_role` = 'return_photo')),
	CONSTRAINT "asset_variants_return_photo_role" CHECK(`media_role` != 'return_photo' OR `usage` IN ('preprocess', 'return-wall')),
	CONSTRAINT "asset_variants_public_watermark" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` != 'watermark' OR ((`watermark_profile` = 'brand-standard-v1' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` != 'none' AND `watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL) OR (`watermark_profile` = 'brand-centered-v2' AND `watermark_profile_id` IS NOT NULL AND `watermark_config_digest` != 'none' AND `logo_digest` != 'none' AND `watermark_anchor` = 'center' AND `watermark_opacity_percent` BETWEEN 10 AND 90 AND `watermark_scale_percent` BETWEEN 20 AND 90))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK(`usage` != 'preprocess' OR (`storage_scope` = 'PRIVATE' AND `protection_mode` = 'none' AND `watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_private_unprotected" CHECK(`storage_scope` != 'PRIVATE' OR `protection_mode` = 'none'),
	CONSTRAINT "asset_variants_ready_output" CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_asset_variants` (
	`id`, `asset_id`, `source_variant_id`, `storage_scope`, `status`,
	`object_key`, `input_sha256`, `media_role`, `usage`, `width`, `height`,
	`format`, `quality`, `crop_identity`, `recipe_version`, `protection_mode`,
	`watermark_profile`, `watermark_profile_id`, `watermark_config_digest`,
	`logo_digest`, `watermark_anchor`, `watermark_opacity_percent`,
	`watermark_scale_percent`, `sha256`, `byte_size`, `version`,
	`internal_error_code`, `created_at`, `updated_at`
)
SELECT
	`id`, `asset_id`, `source_variant_id`, `storage_scope`, `status`,
	`object_key`, `input_sha256`, `media_role`, `usage`, `width`, `height`,
	`format`, `quality`, `crop_identity`, `recipe_version`, `protection_mode`,
	`watermark_profile`, `watermark_profile_id`, `watermark_config_digest`,
	`logo_digest`, `watermark_anchor`, `watermark_opacity_percent`,
	`watermark_scale_percent`, `sha256`, `byte_size`, `version`,
	`internal_error_code`, `created_at`, `updated_at`
FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_legacy_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`) WHERE `watermark_profile_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_profile_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile_id`,`watermark_config_digest`,`logo_digest`,`watermark_anchor`,`watermark_opacity_percent`,`watermark_scale_percent`) WHERE `watermark_profile_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE INDEX `asset_variants_protection_idx` ON `asset_variants` (`storage_scope`,`protection_mode`,`usage`,`status`);--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`private_object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`exif_orientation` integer DEFAULT 1 NOT NULL,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`fit_mode` text DEFAULT 'cover' NOT NULL,
	`watermark_anchor` text DEFAULT 'top-left' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "assets_role" CHECK(`role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo', 'return_photo')),
	CONSTRAINT "assets_status" CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "assets_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "assets_sha256" CHECK(length(`sha256`) = 64 AND `sha256` = lower(`sha256`) AND `sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "assets_byte_size" CHECK(`byte_size` BETWEEN 1 AND 30000000),
	CONSTRAINT "assets_dimensions" CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
	CONSTRAINT "assets_exif_orientation" CHECK(`exif_orientation` BETWEEN 1 AND 8),
	CONSTRAINT "assets_focus" CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
	CONSTRAINT "assets_fit_mode" CHECK(`fit_mode` IN ('cover', 'contain')),
	CONSTRAINT "assets_watermark_anchor" CHECK(`watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
	CONSTRAINT "assets_hero_orientation" CHECK((`role` != 'home_hero_landscape' OR `width` > `height`) AND (`role` != 'home_hero_portrait' OR `height` > `width`)),
	CONSTRAINT "assets_mime_type" CHECK(`mime_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_watermark_logo_png" CHECK(`role` != 'watermark_logo' OR (`mime_type` = 'image/png' AND `byte_size` <= 20000000)),
	CONSTRAINT "assets_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_assets` (
	`id`, `role`, `status`, `private_object_key`, `sha256`, `byte_size`,
	`mime_type`, `width`, `height`, `exif_orientation`, `focal_x`, `focal_y`,
	`fit_mode`, `watermark_anchor`, `version`, `internal_error_code`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `role`, `status`, `private_object_key`, `sha256`, `byte_size`,
	`mime_type`, `width`, `height`, `exif_orientation`, `focal_x`, `focal_y`,
	`fit_mode`, `watermark_anchor`, `version`, `internal_error_code`,
	`created_at`, `updated_at`
FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
CREATE TABLE `return_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`asset_id` text,
	`alt` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`publication_status` text DEFAULT 'draft' NOT NULL,
	`authorization_source` text,
	`authorization_confirmed_at` integer,
	`authorization_note` text,
	`version` integer DEFAULT 1 NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "return_photos_alt_nonempty" CHECK(`alt` = trim(`alt`) AND length(`alt`) BETWEEN 1 AND 500),
	CONSTRAINT "return_photos_publication_status" CHECK(`publication_status` IN ('draft', 'published', 'unpublished')),
	CONSTRAINT "return_photos_sort_order_nonnegative" CHECK(`sort_order` >= 0),
	CONSTRAINT "return_photos_version_positive" CHECK(`version` > 0),
	CONSTRAINT "return_photos_published_at" CHECK(`publication_status` != 'published' OR `published_at` IS NOT NULL),
	CONSTRAINT "return_photos_published_asset" CHECK(`publication_status` != 'published' OR `asset_id` IS NOT NULL),
	CONSTRAINT "return_photos_authorization_source" CHECK(`authorization_source` IS NULL OR `authorization_source` IN ('qq', 'email', 'other')),
	CONSTRAINT "return_photos_authorization_confirmed_at" CHECK(`authorization_confirmed_at` IS NULL OR `authorization_confirmed_at` > 0),
	CONSTRAINT "return_photos_authorization_note" CHECK(`authorization_note` IS NULL OR (`authorization_note` = trim(`authorization_note`) AND length(`authorization_note`) BETWEEN 1 AND 500))
);--> statement-breakpoint
CREATE UNIQUE INDEX `return_photos_asset_unique` ON `return_photos` (`asset_id`);--> statement-breakpoint
CREATE INDEX `return_photos_public_order_idx` ON `return_photos` (`publication_status`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `return_photos_work_idx` ON `return_photos` (`work_id`,`publication_status`);--> statement-breakpoint
CREATE TABLE `__new_upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_version` integer NOT NULL,
	`media_role` text NOT NULL,
	`private_object_key` text NOT NULL,
	`expected_content_type` text NOT NULL,
	`expected_bytes` integer NOT NULL,
	`expected_content_md5` text NOT NULL,
	`expected_sha256` text NOT NULL,
	`expected_width` integer NOT NULL,
	`expected_height` integer NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'AWAITING_UPLOAD' NOT NULL,
	`asset_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`failure_code` text,
	`failure_stage` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`cleaned_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_sessions_owner_type" CHECK(`owner_type` IN ('work', 'site', 'return')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim(`owner_id`)) > 0 AND (`owner_type` != 'site' OR `owner_id` IN ('home', 'branding'))),
	CONSTRAINT "upload_sessions_owner_version" CHECK(`owner_version` >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo')) OR (`owner_type` = 'site' AND `owner_id` = 'home' AND `media_role` IN ('home_hero_landscape', 'home_hero_portrait')) OR (`owner_type` = 'site' AND `owner_id` = 'branding' AND `media_role` = 'watermark_logo') OR (`owner_type` = 'return' AND `media_role` = 'return_photo')),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_watermark_logo_png" CHECK(`media_role` != 'watermark_logo' OR (`expected_content_type` = 'image/png' AND `expected_bytes` <= 20000000)),
	CONSTRAINT "upload_sessions_expected_bytes" CHECK(`expected_bytes` BETWEEN 1 AND 30000000),
	CONSTRAINT "upload_sessions_expected_md5" CHECK(length(`expected_content_md5`) = 24),
	CONSTRAINT "upload_sessions_expected_sha256" CHECK(length(`expected_sha256`) = 64 AND `expected_sha256` = lower(`expected_sha256`) AND `expected_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "upload_sessions_expected_dimensions" CHECK(`expected_width` BETWEEN 1 AND 12000 AND `expected_height` BETWEEN 1 AND 12000),
	CONSTRAINT "upload_sessions_status" CHECK(`status` IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "upload_sessions_asset_state" CHECK((`status` = 'COMPLETED' AND `asset_id` IS NOT NULL) OR (`status` != 'COMPLETED' AND `asset_id` IS NULL)),
	CONSTRAINT "upload_sessions_failure_state" CHECK((`status` = 'FAILED' AND `failure_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `failure_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "upload_sessions_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')),
	CONSTRAINT "upload_sessions_expiry" CHECK(`expires_at` = `created_at` + 300000),
	CONSTRAINT "upload_sessions_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_upload_sessions` (
	`id`, `owner_type`, `owner_id`, `owner_version`, `media_role`,
	`private_object_key`, `expected_content_type`, `expected_bytes`,
	`expected_content_md5`, `expected_sha256`, `expected_width`,
	`expected_height`, `created_by`, `status`, `asset_id`, `version`,
	`failure_code`, `failure_stage`, `created_at`, `expires_at`,
	`updated_at`, `cleaned_at`
)
SELECT
	`id`, `owner_type`, `owner_id`, `owner_version`, `media_role`,
	`private_object_key`, `expected_content_type`, `expected_bytes`,
	`expected_content_md5`, `expected_sha256`, `expected_width`,
	`expected_height`, `created_by`, `status`, `asset_id`, `version`,
	`failure_code`, `failure_stage`, `created_at`, `expires_at`,
	`updated_at`, `cleaned_at`
FROM `upload_sessions`;--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `__new_publication_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_type` text DEFAULT 'PUBLISH' NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`requested_version` integer NOT NULL,
	`status` text NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`internal_error_code` text,
	`internal_error_message` text,
	`failure_stage` text,
	`version` integer DEFAULT 1 NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`heartbeat_at` integer,
	`recovery_reason` text,
	`next_retry_at` integer,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "publication_operations_attempt" CHECK(`attempt` >= 0),
	CONSTRAINT "publication_operations_lease_owner" CHECK(`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200),
	CONSTRAINT "publication_operations_recovery_reason" CHECK(`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')),
	CONSTRAINT "publication_operations_operation_type" CHECK(`operation_type` IN ('PUBLISH', 'UNPUBLISH', 'UPSCALE')),
	CONSTRAINT "publication_operations_entity_type" CHECK(`entity_type` IN ('WORK', 'HOME', 'RETURN_PHOTO')),
	CONSTRAINT "publication_operations_status" CHECK(`status` IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "publication_operations_requested_version" CHECK(`requested_version` > 0),
	CONSTRAINT "publication_operations_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')),
	CONSTRAINT "publication_operations_failure_state" CHECK((`status` = 'FAILED' AND `internal_error_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `internal_error_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "publication_operations_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_publication_operations` (
	`id`, `operation_type`, `entity_type`, `entity_id`, `requested_version`,
	`status`, `cleanup_object_keys_json`, `internal_error_code`,
	`internal_error_message`, `failure_stage`, `version`, `attempt`,
	`lease_owner`, `lease_expires_at`, `heartbeat_at`, `recovery_reason`,
	`next_retry_at`, `started_at`, `updated_at`, `completed_at`
)
SELECT
	`id`, `operation_type`, `entity_type`, `entity_id`, `requested_version`,
	`status`, `cleanup_object_keys_json`, `internal_error_code`,
	`internal_error_message`, `failure_stage`, `version`, `attempt`,
	`lease_owner`, `lease_expires_at`, `heartbeat_at`, `recovery_reason`,
	`next_retry_at`, `started_at`, `updated_at`, `completed_at`
FROM `publication_operations`;--> statement-breakpoint
DROP TABLE `publication_operations`;--> statement-breakpoint
ALTER TABLE `__new_publication_operations` RENAME TO `publication_operations`;--> statement-breakpoint
CREATE INDEX `publication_operations_entity_idx` ON `publication_operations` (`entity_type`,`entity_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `publication_operations_lease_idx` ON `publication_operations` (`status`,`lease_expires_at`);--> statement-breakpoint
-- 3. 所有表就位后统一恢复触发器。
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF
  `asset_id`, `source_variant_id`, `storage_scope`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`,
  `quality`, `crop_identity`, `recipe_version`, `protection_mode`,
  `watermark_profile`, `watermark_profile_id`, `watermark_config_digest`,
  `logo_digest`, `watermark_anchor`, `watermark_opacity_percent`,
  `watermark_scale_percent`
ON `asset_variants`
WHEN
  NEW.`asset_id` != OLD.`asset_id`
  OR NEW.`source_variant_id` IS NOT OLD.`source_variant_id`
  OR NEW.`storage_scope` != OLD.`storage_scope`
  OR NEW.`object_key` != OLD.`object_key`
  OR NEW.`input_sha256` != OLD.`input_sha256`
  OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`usage` != OLD.`usage`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`format` != OLD.`format`
  OR NEW.`quality` != OLD.`quality`
  OR NEW.`crop_identity` != OLD.`crop_identity`
  OR NEW.`recipe_version` != OLD.`recipe_version`
  OR NEW.`protection_mode` != OLD.`protection_mode`
  OR NEW.`watermark_profile` != OLD.`watermark_profile`
  OR NEW.`watermark_profile_id` IS NOT OLD.`watermark_profile_id`
  OR NEW.`watermark_config_digest` != OLD.`watermark_config_digest`
  OR NEW.`logo_digest` != OLD.`logo_digest`
  OR NEW.`watermark_anchor` != OLD.`watermark_anchor`
  OR NEW.`watermark_opacity_percent` IS NOT OLD.`watermark_opacity_percent`
  OR NEW.`watermark_scale_percent` IS NOT OLD.`watermark_scale_percent`
BEGIN
  SELECT RAISE(ABORT, 'asset variant identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  NEW.`media_role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR NOT (
    (NEW.`media_role` = 'studio_photo'
      AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
    OR (NEW.`media_role` = 'design_sheet'
      AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail', 'home-entry-adoption'))
    OR (NEW.`media_role` = 'home_hero_landscape'
      AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait'
      AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'return_photo'
      AND NEW.`usage` IN ('preprocess', 'return-wall'))
  )
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_watermark_profile_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`watermark_profile_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `watermark_profiles`
  WHERE `id` = NEW.`watermark_profile_id`
    AND `profile_name` = NEW.`watermark_profile`
    AND `config_digest` = NEW.`watermark_config_digest`
    AND `logo_digest` = NEW.`logo_digest`
    AND `position` = NEW.`watermark_anchor`
    AND `opacity_percent` = NEW.`watermark_opacity_percent`
    AND `scale_percent` = NEW.`watermark_scale_percent`
    AND `status` IN ('APPLYING', 'ACTIVE')
)
BEGIN
  SELECT RAISE(ABORT, 'variant watermark profile is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (
    NEW.`usage` = 'preprocess'
    AND (
      NEW.`width` > 4096
      OR NEW.`height` > 4096
      OR (NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)
    )
  )
  OR (
    NEW.`source_variant_id` IS NULL
    AND NEW.`input_sha256` != (
      SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`
    )
  )
  OR (
    NEW.`source_variant_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `asset_variants` AS source
      WHERE source.`id` = NEW.`source_variant_id`
        AND source.`asset_id` = NEW.`asset_id`
        AND source.`storage_scope` = 'PRIVATE'
        AND source.`status` = 'READY'
        AND source.`usage` = 'preprocess'
        AND source.`media_role` = NEW.`media_role`
        AND source.`sha256` = NEW.`input_sha256`
        AND source.`byte_size` <= 20000000
        AND source.`width` <= 4096
        AND source.`height` <= 4096
    )
  )
  OR (
    NEW.`storage_scope` = 'PUBLIC'
    AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000
    AND NEW.`source_variant_id` IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN
  NEW.`usage` = 'preprocess'
  AND NEW.`status` = 'READY'
  AND NEW.`byte_size` > 20000000
BEGIN
  SELECT RAISE(ABORT, 'preprocess variant exceeds OSS input limits');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preserve_source`
BEFORE UPDATE OF `status`, `sha256`, `byte_size` ON `asset_variants`
WHEN EXISTS (
  SELECT 1 FROM `asset_variants` AS downstream
  WHERE downstream.`source_variant_id` = OLD.`id`
) AND (
  NEW.`status` != OLD.`status`
  OR NEW.`sha256` IS NOT OLD.`sha256`
  OR NEW.`byte_size` IS NOT OLD.`byte_size`
)
BEGIN
  SELECT RAISE(ABORT, 'referenced processing source is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `assets_original_identity_immutable`
BEFORE UPDATE OF `role`, `private_object_key`, `sha256`, `byte_size`, `mime_type`, `width`, `height`, `exif_orientation`
ON `assets`
WHEN
  NEW.`role` != OLD.`role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`sha256` != OLD.`sha256`
  OR NEW.`byte_size` != OLD.`byte_size`
  OR NEW.`mime_type` != OLD.`mime_type`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`exif_orientation` != OLD.`exif_orientation`
BEGIN
  SELECT RAISE(ABORT, 'original asset identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `assets_preserve_enabled_hero`
BEFORE UPDATE OF `status`, `role` ON `assets`
WHEN (
  NEW.`status` != 'READY'
  OR NEW.`role` != OLD.`role`
) AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1
    AND (
      `landscape_asset_id` = OLD.`id`
      OR `portrait_asset_id` = OLD.`id`
    )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide requires READY assets');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_slides_ready_insert`
BEFORE INSERT ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape'
      AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait'
      AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_slides_ready_update`
BEFORE UPDATE OF
  `landscape_asset_id`, `portrait_asset_id`, `enabled`, `linked_work_id`
ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape'
      AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait'
      AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
END;--> statement-breakpoint
CREATE TRIGGER `watermark_profiles_source_insert`
BEFORE INSERT ON `watermark_profiles`
WHEN NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`source_asset_id`
    AND `role` = 'watermark_logo'
    AND `status` = 'READY'
    AND `mime_type` = 'image/png'
    AND `sha256` = NEW.`logo_digest`
)
BEGIN
  SELECT RAISE(ABORT, 'watermark profile source is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_insert`
BEFORE INSERT ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (
    NEW.`role` = 'design_sheet'
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption'
  )
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_update`
BEFORE UPDATE OF `work_id`, `asset_id`, `role` ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (
    NEW.`role` = 'design_sheet'
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption'
  )
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_immutable`
BEFORE UPDATE OF `role` ON `work_assets`
WHEN NEW.`role` != OLD.`role`
BEGIN
  SELECT RAISE(ABORT, 'work asset role changes require relation replacement');
END;
--> statement-breakpoint
CREATE TRIGGER `return_photos_asset_role_insert`
BEFORE INSERT ON `return_photos`
WHEN NEW.`asset_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`asset_id`
    AND `role` = 'return_photo'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'return photo requires a ready return_photo asset');
END;--> statement-breakpoint
CREATE TRIGGER `return_photos_asset_role_update`
BEFORE UPDATE OF `asset_id` ON `return_photos`
WHEN NEW.`asset_id` IS NOT OLD.`asset_id`
  AND NEW.`asset_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`asset_id`
      AND `role` = 'return_photo'
      AND `status` = 'READY'
  )
BEGIN
  SELECT RAISE(ABORT, 'return photo requires a ready return_photo asset');
END;--> statement-breakpoint
CREATE TRIGGER `return_photos_published_work_insert`
BEFORE INSERT ON `return_photos`
WHEN NEW.`publication_status` = 'published' AND NOT EXISTS (
  SELECT 1 FROM `works`
  WHERE `id` = NEW.`work_id` AND `publication_status` = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'published return photo requires a published work');
END;--> statement-breakpoint
CREATE TRIGGER `return_photos_published_work_update`
BEFORE UPDATE OF `publication_status`, `work_id` ON `return_photos`
WHEN NEW.`publication_status` = 'published'
  AND (
    OLD.`publication_status` != 'published'
    OR NEW.`work_id` != OLD.`work_id`
  )
  AND NOT EXISTS (
    SELECT 1 FROM `works`
    WHERE `id` = NEW.`work_id` AND `publication_status` = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'published return photo requires a published work');
END;--> statement-breakpoint
CREATE TRIGGER `return_photos_published_identity_update`
BEFORE UPDATE OF `work_id`, `asset_id` ON `return_photos`
WHEN OLD.`publication_status` = 'published'
  AND (
    NEW.`work_id` != OLD.`work_id`
    OR NEW.`asset_id` IS NOT OLD.`asset_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'published return photo relations require unpublishing first');
END;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_identity_immutable`
BEFORE UPDATE OF
  `owner_type`, `owner_id`, `owner_version`, `media_role`,
  `private_object_key`, `expected_content_type`, `expected_bytes`,
  `expected_content_md5`, `expected_sha256`, `expected_width`,
  `expected_height`, `created_by`, `created_at`, `expires_at`
ON `upload_sessions`
WHEN
  NEW.`owner_type` != OLD.`owner_type`
  OR NEW.`owner_id` != OLD.`owner_id`
  OR NEW.`owner_version` != OLD.`owner_version`
  OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`expected_content_type` != OLD.`expected_content_type`
  OR NEW.`expected_bytes` != OLD.`expected_bytes`
  OR NEW.`expected_content_md5` != OLD.`expected_content_md5`
  OR NEW.`expected_sha256` != OLD.`expected_sha256`
  OR NEW.`expected_width` != OLD.`expected_width`
  OR NEW.`expected_height` != OLD.`expected_height`
  OR NEW.`created_by` != OLD.`created_by`
  OR NEW.`created_at` != OLD.`created_at`
  OR NEW.`expires_at` != OLD.`expires_at`
BEGIN
  SELECT RAISE(ABORT, 'upload session identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_owner_insert`
BEFORE INSERT ON `upload_sessions`
WHEN
  (
    NEW.`owner_type` = 'work'
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
        AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'home'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (
      SELECT `version` FROM `site_branding` WHERE `id` = 'site'
    )
  )
  OR (
    NEW.`owner_type` = 'return'
    AND NOT EXISTS (
      SELECT 1 FROM `return_photos`
      WHERE `id` = NEW.`owner_id` AND `version` = NEW.`owner_version`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_insert`
BEFORE INSERT ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_update`
BEFORE UPDATE OF `status`, `internal_error_code`, `failure_stage`
ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
