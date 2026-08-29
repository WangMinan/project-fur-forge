-- R4: retire the complete watermark feature while preserving normal media and publications.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

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
  `version` integer DEFAULT 1 NOT NULL,
  `internal_error_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `assets_role` CHECK(`role` IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')),
  CONSTRAINT `assets_status` CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
  CONSTRAINT `assets_private_key_relative` CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
  CONSTRAINT `assets_sha256` CHECK(length(`sha256`) = 64 AND `sha256` = lower(`sha256`) AND `sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `assets_byte_size` CHECK(`byte_size` BETWEEN 1 AND 30000000),
  CONSTRAINT `assets_dimensions` CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
  CONSTRAINT `assets_exif_orientation` CHECK(`exif_orientation` BETWEEN 1 AND 8),
  CONSTRAINT `assets_focus` CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
  CONSTRAINT `assets_fit_mode` CHECK(`fit_mode` IN ('cover', 'contain')),
  CONSTRAINT `assets_hero_orientation` CHECK((`role` != 'home_hero_landscape' OR `width` > `height`) AND (`role` != 'home_hero_portrait' OR `height` > `width`)),
  CONSTRAINT `assets_adoption_cover_landscape` CHECK(`role` != 'adoption_cover' OR `width` > `height`),
  CONSTRAINT `assets_commission_reference_private_source` CHECK(`role` != 'commission_design_reference' OR `byte_size` <= 20000000),
  CONSTRAINT `assets_mime_type` CHECK(`mime_type` IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT `assets_contact_qr_source` CHECK(`role` != 'contact_qr' OR (`byte_size` <= 20000000 AND `width` >= 64 AND `height` >= 64 AND `fit_mode` = 'contain')),
  CONSTRAINT `assets_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_assets` (
  `id`, `role`, `status`, `private_object_key`, `sha256`, `byte_size`,
  `mime_type`, `width`, `height`, `exif_orientation`, `focal_x`, `focal_y`,
  `fit_mode`, `version`, `internal_error_code`, `created_at`, `updated_at`
)
SELECT
  `id`, `role`, `status`, `private_object_key`, `sha256`, `byte_size`,
  `mime_type`, `width`, `height`, `exif_orientation`, `focal_x`, `focal_y`,
  `fit_mode`, `version`, `internal_error_code`, `created_at`, `updated_at`
FROM `assets` WHERE `role` != 'watermark_logo';--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
CREATE TRIGGER `assets_original_identity_immutable`
BEFORE UPDATE OF `role`, `private_object_key`, `sha256`, `byte_size`, `mime_type`, `width`, `height`, `exif_orientation`
ON `assets`
WHEN NEW.`role` != OLD.`role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`sha256` != OLD.`sha256`
  OR NEW.`byte_size` != OLD.`byte_size`
  OR NEW.`mime_type` != OLD.`mime_type`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`exif_orientation` != OLD.`exif_orientation`
BEGIN SELECT RAISE(ABORT, 'original asset identity is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `assets_preserve_enabled_hero`
BEFORE UPDATE OF `status`, `role` ON `assets`
WHEN (NEW.`status` != 'READY' OR NEW.`role` != OLD.`role`) AND EXISTS (
  SELECT 1 FROM `site_hero_items` WHERE `enabled` = 1 AND `asset_id` = OLD.`id`
)
BEGIN SELECT RAISE(ABORT, 'enabled hero item requires a READY asset'); END;--> statement-breakpoint

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
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `status` text DEFAULT 'AWAITING_UPLOAD' NOT NULL,
  `asset_id` text REFERENCES `assets`(`id`),
  `version` integer DEFAULT 1 NOT NULL,
  `failure_code` text,
  `failure_stage` text,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `cleaned_at` integer,
  CONSTRAINT `upload_sessions_owner_type` CHECK(`owner_type` IN ('work', 'site')),
  CONSTRAINT `upload_sessions_owner_id` CHECK(length(trim(`owner_id`)) > 0 AND (`owner_type` != 'site' OR `owner_id` IN ('hero-home-landscape', 'hero-home-portrait', 'hero-commission-landscape', 'hero-commission-portrait', 'contact'))),
  CONSTRAINT `upload_sessions_owner_version` CHECK(`owner_version` >= 0),
  CONSTRAINT `upload_sessions_media_role` CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo', 'adoption_cover')) OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-landscape', 'hero-commission-landscape') AND `media_role` = 'home_hero_landscape') OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-portrait', 'hero-commission-portrait') AND `media_role` = 'home_hero_portrait') OR (`owner_type` = 'site' AND `owner_id` = 'contact' AND `media_role` = 'contact_qr')),
  CONSTRAINT `upload_sessions_private_key_relative` CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
  CONSTRAINT `upload_sessions_content_type` CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT `upload_sessions_contact_qr_source` CHECK(`media_role` != 'contact_qr' OR (`expected_bytes` <= 20000000 AND `expected_width` >= 64 AND `expected_height` >= 64)),
  CONSTRAINT `upload_sessions_adoption_cover_landscape` CHECK(`media_role` != 'adoption_cover' OR `expected_width` > `expected_height`),
  CONSTRAINT `upload_sessions_expected_bytes` CHECK(`expected_bytes` BETWEEN 1 AND 30000000),
  CONSTRAINT `upload_sessions_expected_md5` CHECK(length(`expected_content_md5`) = 24),
  CONSTRAINT `upload_sessions_expected_sha256` CHECK(length(`expected_sha256`) = 64 AND `expected_sha256` = lower(`expected_sha256`) AND `expected_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `upload_sessions_expected_dimensions` CHECK(`expected_width` BETWEEN 1 AND 12000 AND `expected_height` BETWEEN 1 AND 12000),
  CONSTRAINT `upload_sessions_status` CHECK(`status` IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT `upload_sessions_asset_state` CHECK((`status` = 'COMPLETED' AND `asset_id` IS NOT NULL) OR (`status` != 'COMPLETED' AND `asset_id` IS NULL)),
  CONSTRAINT `upload_sessions_failure_state` CHECK((`status` = 'FAILED' AND `failure_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `failure_code` IS NULL AND `failure_stage` IS NULL)),
  CONSTRAINT `upload_sessions_failure_stage` CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')),
  CONSTRAINT `upload_sessions_expiry` CHECK(`expires_at` = `created_at` + 300000),
  CONSTRAINT `upload_sessions_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_upload_sessions`
SELECT * FROM `upload_sessions`
WHERE `owner_id` != 'branding' AND `media_role` != 'watermark_logo'
  AND (`asset_id` IS NULL OR `asset_id` IN (SELECT `id` FROM `assets`));--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);--> statement-breakpoint
CREATE TRIGGER `upload_sessions_identity_immutable`
BEFORE UPDATE OF `owner_type`, `owner_id`, `owner_version`, `media_role`, `private_object_key`, `expected_content_type`, `expected_bytes`, `expected_content_md5`, `expected_sha256`, `expected_width`, `expected_height`, `created_by`, `created_at`, `expires_at`
ON `upload_sessions`
WHEN NEW.`owner_type` != OLD.`owner_type` OR NEW.`owner_id` != OLD.`owner_id`
  OR NEW.`owner_version` != OLD.`owner_version` OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`private_object_key` != OLD.`private_object_key` OR NEW.`expected_content_type` != OLD.`expected_content_type`
  OR NEW.`expected_bytes` != OLD.`expected_bytes` OR NEW.`expected_content_md5` != OLD.`expected_content_md5`
  OR NEW.`expected_sha256` != OLD.`expected_sha256` OR NEW.`expected_width` != OLD.`expected_width`
  OR NEW.`expected_height` != OLD.`expected_height` OR NEW.`created_by` != OLD.`created_by`
  OR NEW.`created_at` != OLD.`created_at` OR NEW.`expires_at` != OLD.`expires_at`
BEGIN SELECT RAISE(ABORT, 'upload session identity is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_owner_insert`
BEFORE INSERT ON `upload_sessions`
WHEN (NEW.`owner_type` = 'work' AND NOT EXISTS (
    SELECT 1 FROM `works` WHERE `id` = NEW.`owner_id` AND `version` = NEW.`owner_version`
      AND (NEW.`media_role` NOT IN ('design_sheet', 'adoption_cover') OR `purpose` = 'adoption')
  ))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` LIKE 'hero-%' AND NEW.`owner_version` != COALESCE((
    SELECT `version` FROM `site_hero_collections`
    WHERE `placement` = CASE WHEN NEW.`owner_id` LIKE 'hero-home-%' THEN 'home' ELSE 'commission' END
      AND `orientation` = CASE WHEN NEW.`owner_id` LIKE '%-landscape' THEN 'landscape' ELSE 'portrait' END
  ), 0))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'contact' AND NEW.`owner_version` != COALESCE((SELECT `contact_content_version` FROM `site_content` WHERE `id` = 'site'), 0))
BEGIN SELECT RAISE(ABORT, 'upload session owner is stale or incompatible'); END;--> statement-breakpoint

CREATE TABLE `__new_asset_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `asset_id` text NOT NULL REFERENCES `assets`(`id`) ON DELETE cascade,
  `source_variant_id` text REFERENCES `asset_variants`(`id`),
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
  `sha256` text,
  `byte_size` integer,
  `version` integer DEFAULT 1 NOT NULL,
  `internal_error_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `asset_variants_storage_scope` CHECK(`storage_scope` IN ('PRIVATE', 'PUBLIC')),
  CONSTRAINT `asset_variants_status` CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
  CONSTRAINT `asset_variants_key_relative` CHECK(length(trim(`object_key`)) > 0 AND instr(`object_key`, '://') = 0 AND substr(`object_key`, 1, 1) != '/'),
  CONSTRAINT `asset_variants_input_sha256` CHECK(length(`input_sha256`) = 64 AND `input_sha256` = lower(`input_sha256`) AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `asset_variants_media_role` CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')),
  CONSTRAINT `asset_variants_usage` CHECK(`usage` IN ('preprocess', 'work-card', 'adoption-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'contact-qr')),
  CONSTRAINT `asset_variants_dimensions` CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
  CONSTRAINT `asset_variants_format` CHECK(`format` IN ('webp', 'jpeg', 'png')),
  CONSTRAINT `asset_variants_quality` CHECK(`quality` BETWEEN 1 AND 100),
  CONSTRAINT `asset_variants_identity_text` CHECK(length(trim(`crop_identity`)) > 0 AND length(trim(`recipe_version`)) > 0),
  CONSTRAINT `asset_variants_site_display_recipe` CHECK(`recipe_version` NOT IN ('site-display-v1', 'site-display-v2') OR (`storage_scope` = 'PUBLIC' AND `usage` IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))),
  CONSTRAINT `asset_variants_site_display_usage` CHECK(`usage` NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (`storage_scope` = 'PUBLIC' AND `recipe_version` IN ('site-display-v1', 'site-display-v2'))),
  CONSTRAINT `asset_variants_commission_private` CHECK(`media_role` != 'commission_design_reference' OR `storage_scope` = 'PRIVATE'),
  CONSTRAINT `asset_variants_contact_qr_recipe` CHECK(`recipe_version` != 'contact-qr-v1' OR (`storage_scope` = 'PUBLIC' AND `usage` = 'contact-qr' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
  CONSTRAINT `asset_variants_contact_qr_usage` CHECK(`usage` != 'contact-qr' OR (`storage_scope` = 'PUBLIC' AND `recipe_version` = 'contact-qr-v1' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
  CONSTRAINT `asset_variants_contact_qr_role` CHECK(`media_role` != 'contact_qr' OR `usage` IN ('preprocess', 'contact-qr')),
  CONSTRAINT `asset_variants_preprocess_private` CHECK(`usage` != 'preprocess' OR `storage_scope` = 'PRIVATE'),
  CONSTRAINT `asset_variants_ready_output` CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
  CONSTRAINT `asset_variants_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_asset_variants` (
  `id`, `asset_id`, `source_variant_id`, `storage_scope`, `status`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`, `quality`,
  `crop_identity`, `recipe_version`, `sha256`, `byte_size`, `version`,
  `internal_error_code`, `created_at`, `updated_at`
)
SELECT
  `id`, `asset_id`, `source_variant_id`, `storage_scope`, `status`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`, `quality`,
  `crop_identity`, `recipe_version`, `sha256`, `byte_size`, `version`,
  `internal_error_code`, `created_at`, `updated_at`
FROM (
  SELECT legacy.*,
    row_number() OVER (
      PARTITION BY `asset_id`, `input_sha256`, `media_role`, `usage`, `width`,
        `height`, `format`, `quality`, `crop_identity`, `recipe_version`
      ORDER BY `updated_at` DESC, `id` DESC
    ) AS identity_rank
  FROM `asset_variants` AS legacy
  WHERE `asset_id` IN (SELECT `id` FROM `assets`)
) WHERE identity_rank = 1;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`);--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF `asset_id`, `source_variant_id`, `storage_scope`, `object_key`, `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`, `quality`, `crop_identity`, `recipe_version`
ON `asset_variants`
WHEN NEW.`asset_id` != OLD.`asset_id` OR NEW.`source_variant_id` IS NOT OLD.`source_variant_id`
  OR NEW.`storage_scope` != OLD.`storage_scope` OR NEW.`object_key` != OLD.`object_key`
  OR NEW.`input_sha256` != OLD.`input_sha256` OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`usage` != OLD.`usage` OR NEW.`width` != OLD.`width` OR NEW.`height` != OLD.`height`
  OR NEW.`format` != OLD.`format` OR NEW.`quality` != OLD.`quality`
  OR NEW.`crop_identity` != OLD.`crop_identity` OR NEW.`recipe_version` != OLD.`recipe_version`
BEGIN SELECT RAISE(ABORT, 'asset variant identity is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN NEW.`usage` = 'preprocess' AND NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000
BEGIN SELECT RAISE(ABORT, 'preprocess variant exceeds OSS input limits'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preserve_source`
BEFORE UPDATE OF `status`, `sha256`, `byte_size` ON `asset_variants`
WHEN EXISTS (SELECT 1 FROM `asset_variants` AS downstream WHERE downstream.`source_variant_id` = OLD.`id`)
  AND (NEW.`status` != OLD.`status` OR NEW.`sha256` IS NOT OLD.`sha256` OR NEW.`byte_size` IS NOT OLD.`byte_size`)
BEGIN SELECT RAISE(ABORT, 'referenced processing source is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`media_role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR NOT (
    (NEW.`media_role` = 'studio_photo' AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
    OR (NEW.`media_role` = 'design_sheet' AND NEW.`usage` IN ('preprocess', 'design-sheet'))
    OR (NEW.`media_role` = 'adoption_cover' AND NEW.`usage` IN ('preprocess', 'adoption-card', 'home-entry-adoption'))
    OR (NEW.`media_role` = 'commission_design_reference' AND NEW.`usage` = 'preprocess')
    OR (NEW.`media_role` = 'home_hero_landscape' AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait' AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'contact_qr' AND NEW.`usage` IN ('preprocess', 'contact-qr'))
  )
BEGIN SELECT RAISE(ABORT, 'variant role and usage are incompatible'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (NEW.`usage` = 'preprocess' AND ((NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)
    OR ((NEW.`width` > 4096 OR NEW.`height` > 4096) AND NOT (
      (NEW.`media_role` = 'studio_photo' AND NEW.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
      OR (NEW.`media_role` = 'design_sheet' AND NEW.`recipe_version` = 'design-sheet-upscale-lanczos-v1')
    ))))
  OR (NEW.`source_variant_id` IS NULL AND NEW.`input_sha256` != (SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`))
  OR (NEW.`source_variant_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `asset_variants` AS source
    WHERE source.`id` = NEW.`source_variant_id` AND source.`asset_id` = NEW.`asset_id`
      AND source.`storage_scope` = 'PRIVATE' AND source.`status` = 'READY'
      AND source.`usage` = 'preprocess' AND source.`media_role` = NEW.`media_role`
      AND source.`sha256` = NEW.`input_sha256` AND source.`byte_size` <= 20000000
      AND ((source.`width` <= 4096 AND source.`height` <= 4096)
        OR (source.`media_role` = 'studio_photo' AND source.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
        OR (source.`media_role` = 'design_sheet' AND source.`recipe_version` = 'design-sheet-upscale-lanczos-v1'))
  ))
  OR (NEW.`storage_scope` = 'PUBLIC' AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000 AND NEW.`source_variant_id` IS NULL)
BEGIN SELECT RAISE(ABORT, 'variant processing source is invalid'); END;--> statement-breakpoint

CREATE TABLE `__new_work_assets` (
  `work_id` text NOT NULL REFERENCES `works`(`id`) ON DELETE cascade,
  `asset_id` text NOT NULL REFERENCES `assets`(`id`),
  `role` text NOT NULL,
  `alt_text` text,
  `position` integer NOT NULL,
  `is_primary` integer DEFAULT false NOT NULL,
  `focal_x` real DEFAULT 0.5 NOT NULL,
  `focal_y` real DEFAULT 0.5 NOT NULL,
  `crop_x` real DEFAULT 0 NOT NULL,
  `crop_y` real DEFAULT 0 NOT NULL,
  `crop_width` real DEFAULT 1 NOT NULL,
  `crop_height` real DEFAULT 1 NOT NULL,
  PRIMARY KEY (`work_id`, `asset_id`),
  CONSTRAINT `work_assets_role` CHECK(`role` IN ('design_sheet', 'studio_photo', 'adoption_cover')),
  CONSTRAINT `work_assets_alt_text` CHECK(`alt_text` IS NULL OR (`alt_text` = trim(`alt_text`) AND length(`alt_text`) BETWEEN 1 AND 500)),
  CONSTRAINT `work_assets_position` CHECK((`role` IN ('design_sheet', 'adoption_cover') AND `position` = 0) OR (`role` = 'studio_photo' AND `position` BETWEEN 0 AND 4)),
  CONSTRAINT `work_assets_primary` CHECK(`role` = 'studio_photo' OR `is_primary` = 0),
  CONSTRAINT `work_assets_focus` CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
  CONSTRAINT `work_assets_crop` CHECK(`crop_x` BETWEEN 0 AND 1 AND `crop_y` BETWEEN 0 AND 1 AND `crop_width` > 0 AND `crop_width` <= 1 AND `crop_height` > 0 AND `crop_height` <= 1 AND `crop_x` + `crop_width` <= 1 AND `crop_y` + `crop_height` <= 1)
);--> statement-breakpoint
INSERT INTO `__new_work_assets`
SELECT `work_id`, `asset_id`, `role`, `alt_text`, `position`, `is_primary`,
  `focal_x`, `focal_y`, `crop_x`, `crop_y`, `crop_width`, `crop_height`
FROM `work_assets` WHERE `asset_id` IN (SELECT `id` FROM `assets`);--> statement-breakpoint
DROP TABLE `work_assets`;--> statement-breakpoint
ALTER TABLE `__new_work_assets` RENAME TO `work_assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_asset_unique` ON `work_assets` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_position_unique` ON `work_assets` (`work_id`,`role`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_primary_unique` ON `work_assets` (`work_id`,`role`) WHERE `is_primary` = 1;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_insert` BEFORE INSERT ON `work_assets`
WHEN NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover') AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
BEGIN SELECT RAISE(ABORT, 'work asset role is invalid'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_update` BEFORE UPDATE OF `work_id`, `asset_id`, `role` ON `work_assets`
WHEN NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover') AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
BEGIN SELECT RAISE(ABORT, 'work asset role is invalid'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_immutable` BEFORE UPDATE OF `role` ON `work_assets`
WHEN NEW.`role` != OLD.`role`
BEGIN SELECT RAISE(ABORT, 'work asset role changes require relation replacement'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_insert` BEFORE INSERT ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (NEW.`alt_text` != trim(NEW.`alt_text`) OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500)
BEGIN SELECT RAISE(ABORT, 'work asset alt text is invalid'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_update` BEFORE UPDATE OF `alt_text` ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (NEW.`alt_text` != trim(NEW.`alt_text`) OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500)
BEGIN SELECT RAISE(ABORT, 'work asset alt text is invalid'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_non_studio_primary_insert` BEFORE INSERT ON `work_assets`
WHEN NEW.`role` != 'studio_photo' AND NEW.`is_primary` != 0
BEGIN SELECT RAISE(ABORT, 'only studio photos can be primary'); END;--> statement-breakpoint
CREATE TRIGGER `work_assets_non_studio_primary_update` BEFORE UPDATE OF `is_primary`, `role` ON `work_assets`
WHEN NEW.`role` != 'studio_photo' AND NEW.`is_primary` != 0
BEGIN SELECT RAISE(ABORT, 'only studio photos can be primary'); END;--> statement-breakpoint

CREATE TABLE `__new_publication_operations` (
  `id` text PRIMARY KEY NOT NULL,
  `operation_type` text DEFAULT 'PUBLISH' NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `requested_version` integer NOT NULL,
  `status` text NOT NULL,
  `cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
  `edge_purge_urls_json` text DEFAULT '[]' NOT NULL,
  `edge_purge_task_id` text,
  `edge_purge_status` text DEFAULT 'NOT_REQUIRED' NOT NULL,
  `edge_purge_reason` text,
  `edge_purge_checked_at` integer,
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
  CONSTRAINT `publication_operations_attempt` CHECK(`attempt` >= 0),
  CONSTRAINT `publication_operations_lease_owner` CHECK(`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200),
  CONSTRAINT `publication_operations_recovery_reason` CHECK(`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')),
  CONSTRAINT `publication_operations_operation_type` CHECK(`operation_type` IN ('PUBLISH', 'UNPUBLISH', 'UPSCALE')),
  CONSTRAINT `publication_operations_entity_type` CHECK(`entity_type` IN ('WORK', 'HOME')),
  CONSTRAINT `publication_operations_status` CHECK(`status` IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
  CONSTRAINT `publication_operations_requested_version` CHECK(`requested_version` > 0),
  CONSTRAINT `publication_operations_failure_stage` CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')),
  CONSTRAINT `publication_operations_failure_state` CHECK((`status` = 'FAILED' AND `internal_error_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `internal_error_code` IS NULL AND `failure_stage` IS NULL)),
  CONSTRAINT `publication_operations_edge_purge_status` CHECK(`edge_purge_status` IN ('NOT_REQUIRED', 'PENDING', 'PURGING', 'COMPLETE', 'FAILED')),
  CONSTRAINT `publication_operations_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_publication_operations`
SELECT `id`, `operation_type`, `entity_type`, `entity_id`, `requested_version`,
  CASE WHEN `status` = 'APPLYING_WATERMARK' THEN 'GENERATING_PUBLIC' ELSE `status` END,
  `cleanup_object_keys_json`, `edge_purge_urls_json`, `edge_purge_task_id`,
  `edge_purge_status`, `edge_purge_reason`, `edge_purge_checked_at`,
  `internal_error_code`, `internal_error_message`,
  CASE WHEN `failure_stage` = 'APPLYING_WATERMARK' THEN 'GENERATING_PUBLIC' ELSE `failure_stage` END,
  `version`, `attempt`, `lease_owner`, `lease_expires_at`, `heartbeat_at`,
  `recovery_reason`, `next_retry_at`, `started_at`, `updated_at`, `completed_at`
FROM `publication_operations`;--> statement-breakpoint
DROP TABLE `publication_operations`;--> statement-breakpoint
ALTER TABLE `__new_publication_operations` RENAME TO `publication_operations`;--> statement-breakpoint
CREATE INDEX `publication_operations_entity_idx` ON `publication_operations` (`entity_type`,`entity_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `publication_operations_lease_idx` ON `publication_operations` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `publication_operations_edge_purge_idx` ON `publication_operations` (`edge_purge_status`,`updated_at`);--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_insert` BEFORE INSERT ON `publication_operations`
WHEN NOT ((NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL) OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL))
BEGIN SELECT RAISE(ABORT, 'publication operation failure state is invalid'); END;--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_update` BEFORE UPDATE OF `status`, `internal_error_code`, `failure_stage` ON `publication_operations`
WHEN NOT ((NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL) OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL))
BEGIN SELECT RAISE(ABORT, 'publication operation failure state is invalid'); END;--> statement-breakpoint

DROP TABLE IF EXISTS `site_branding`;--> statement-breakpoint
DROP TABLE IF EXISTS `watermark_operations`;--> statement-breakpoint
DROP TABLE IF EXISTS `watermark_profiles`;--> statement-breakpoint

PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
