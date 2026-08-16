-- R3-B/T10-T13: expand adoption media/status and private commission models.
-- Legacy work columns intentionally remain until the later Works contract stage.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

ALTER TABLE `works` ADD `adoption_status` text
  CONSTRAINT `works_adoption_status` CHECK(
    (`purpose` = 'adoption' AND (`adoption_status` IS NULL OR `adoption_status` IN ('available', 'adopted')))
    OR (`purpose` != 'adoption' AND `adoption_status` IS NULL)
  );--> statement-breakpoint
UPDATE `works`
SET `adoption_status` = CASE `business_status`
  WHEN 'available' THEN 'available'
  WHEN 'delivered' THEN 'adopted'
  ELSE NULL
END
WHERE `purpose` = 'adoption';--> statement-breakpoint

DROP TRIGGER IF EXISTS `assets_original_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
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
	CONSTRAINT "assets_role" CHECK(`role` IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo', 'contact_qr')),
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
	CONSTRAINT "assets_adoption_cover_landscape" CHECK(`role` != 'adoption_cover' OR `width` > `height`),
	CONSTRAINT "assets_commission_reference_private_source" CHECK(`role` != 'commission_design_reference' OR `byte_size` <= 20000000),
	CONSTRAINT "assets_mime_type" CHECK(`mime_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_watermark_logo_png" CHECK(`role` != 'watermark_logo' OR (`mime_type` = 'image/png' AND `byte_size` <= 20000000)),
	CONSTRAINT "assets_contact_qr_source" CHECK(`role` != 'contact_qr' OR (`mime_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `byte_size` <= 20000000 AND `width` >= 64 AND `height` >= 64 AND `fit_mode` = 'contain')),
	CONSTRAINT "assets_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_assets` SELECT * FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
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
WHEN (NEW.`status` != 'READY' OR NEW.`role` != OLD.`role`) AND (
  EXISTS (
    SELECT 1 FROM `site_hero_slides`
    WHERE `enabled` = 1
      AND (`landscape_asset_id` = OLD.`id` OR `portrait_asset_id` = OLD.`id`)
  )
  OR EXISTS (
    SELECT 1 FROM `site_hero_items`
    WHERE `enabled` = 1 AND `asset_id` = OLD.`id`
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero item requires a READY asset');
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS `work_assets_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_alt_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_alt_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_design_sheet_primary_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_design_sheet_primary_update`;--> statement-breakpoint
CREATE TABLE `__new_work_assets` (
	`work_id` text NOT NULL,
	`asset_id` text NOT NULL,
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
	`watermark_anchor` text DEFAULT 'top-left' NOT NULL,
	PRIMARY KEY (`work_id`, `asset_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "work_assets_role" CHECK(`role` IN ('design_sheet', 'studio_photo', 'adoption_cover')),
	CONSTRAINT "work_assets_alt_text" CHECK(`alt_text` IS NULL OR (`alt_text` = trim(`alt_text`) AND length(`alt_text`) BETWEEN 1 AND 500)),
	CONSTRAINT "work_assets_position" CHECK((`role` IN ('design_sheet', 'adoption_cover') AND `position` = 0) OR (`role` = 'studio_photo' AND `position` BETWEEN 0 AND 4)),
	CONSTRAINT "work_assets_primary" CHECK(`role` = 'studio_photo' OR `is_primary` = 0),
	CONSTRAINT "work_assets_focus" CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
	CONSTRAINT "work_assets_crop" CHECK(`crop_x` BETWEEN 0 AND 1 AND `crop_y` BETWEEN 0 AND 1 AND `crop_width` > 0 AND `crop_width` <= 1 AND `crop_height` > 0 AND `crop_height` <= 1 AND `crop_x` + `crop_width` <= 1 AND `crop_y` + `crop_height` <= 1),
	CONSTRAINT "work_assets_watermark_anchor" CHECK(`watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right'))
);--> statement-breakpoint
INSERT INTO `__new_work_assets` (
  `work_id`, `asset_id`, `role`, `alt_text`, `position`, `is_primary`,
  `focal_x`, `focal_y`, `crop_x`, `crop_y`, `crop_width`, `crop_height`,
  `watermark_anchor`
)
SELECT
  `work_id`, `asset_id`, `role`, `alt_text`, `position`, `is_primary`,
  `focal_x`, `focal_y`, `crop_x`, `crop_y`, `crop_width`, `crop_height`,
  `watermark_anchor`
FROM `work_assets`;--> statement-breakpoint
DROP TABLE `work_assets`;--> statement-breakpoint
ALTER TABLE `__new_work_assets` RENAME TO `work_assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_asset_unique` ON `work_assets` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_position_unique` ON `work_assets` (`work_id`,`role`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_primary_unique` ON `work_assets` (`work_id`,`role`) WHERE `is_primary` = 1;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_insert`
BEFORE INSERT ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover')
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_update`
BEFORE UPDATE OF `work_id`, `asset_id`, `role` ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover')
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_immutable`
BEFORE UPDATE OF `role` ON `work_assets`
WHEN NEW.`role` != OLD.`role`
BEGIN
  SELECT RAISE(ABORT, 'work asset role changes require relation replacement');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_insert`
BEFORE INSERT ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (
  NEW.`alt_text` != trim(NEW.`alt_text`)
  OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500
)
BEGIN
  SELECT RAISE(ABORT, 'work asset alt text is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_update`
BEFORE UPDATE OF `alt_text` ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (
  NEW.`alt_text` != trim(NEW.`alt_text`)
  OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500
)
BEGIN
  SELECT RAISE(ABORT, 'work asset alt text is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_non_studio_primary_insert`
BEFORE INSERT ON `work_assets`
WHEN NEW.`role` != 'studio_photo' AND NEW.`is_primary` != 0
BEGIN
  SELECT RAISE(ABORT, 'only studio photos can be primary');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_non_studio_primary_update`
BEFORE UPDATE OF `is_primary`, `role` ON `work_assets`
WHEN NEW.`role` != 'studio_photo' AND NEW.`is_primary` != 0
BEGIN
  SELECT RAISE(ABORT, 'only studio photos can be primary');
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS `upload_sessions_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
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
	CONSTRAINT "upload_sessions_owner_type" CHECK(`owner_type` IN ('work', 'site')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim(`owner_id`)) > 0 AND (`owner_type` != 'site' OR `owner_id` IN ('hero-home-landscape', 'hero-home-portrait', 'hero-commission-landscape', 'hero-commission-portrait', 'branding', 'contact'))),
	CONSTRAINT "upload_sessions_owner_version" CHECK(`owner_version` >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo', 'adoption_cover')) OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-landscape', 'hero-commission-landscape') AND `media_role` = 'home_hero_landscape') OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-portrait', 'hero-commission-portrait') AND `media_role` = 'home_hero_portrait') OR (`owner_type` = 'site' AND `owner_id` = 'branding' AND `media_role` = 'watermark_logo') OR (`owner_type` = 'site' AND `owner_id` = 'contact' AND `media_role` = 'contact_qr')),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_watermark_logo_png" CHECK(`media_role` != 'watermark_logo' OR (`expected_content_type` = 'image/png' AND `expected_bytes` <= 20000000)),
	CONSTRAINT "upload_sessions_contact_qr_source" CHECK(`media_role` != 'contact_qr' OR (`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `expected_bytes` <= 20000000 AND `expected_width` >= 64 AND `expected_height` >= 64)),
	CONSTRAINT "upload_sessions_adoption_cover_landscape" CHECK(`media_role` != 'adoption_cover' OR `expected_width` > `expected_height`),
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
INSERT INTO `__new_upload_sessions` SELECT * FROM `upload_sessions`;--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);--> statement-breakpoint
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
  (NEW.`owner_type` = 'work' AND NOT EXISTS (
    SELECT 1 FROM `works` WHERE `id` = NEW.`owner_id`
      AND `version` = NEW.`owner_version`
      AND (NEW.`media_role` NOT IN ('design_sheet', 'adoption_cover') OR `purpose` = 'adoption')
  ))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` LIKE 'hero-%'
    AND NEW.`owner_version` != COALESCE((
      SELECT `version` FROM `site_hero_collections`
      WHERE `placement` = CASE WHEN NEW.`owner_id` LIKE 'hero-home-%' THEN 'home' ELSE 'commission' END
        AND `orientation` = CASE WHEN NEW.`owner_id` LIKE '%-landscape' THEN 'landscape' ELSE 'portrait' END
    ), 0))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (SELECT `version` FROM `site_branding` WHERE `id` = 'site'))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'contact'
    AND NEW.`owner_version` != COALESCE((SELECT `contact_content_version` FROM `site_content` WHERE `id` = 'site'), 0))
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS `asset_variants_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_role_usage_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_watermark_profile_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_source_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preprocess_limit_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preserve_source`;--> statement-breakpoint
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
	CONSTRAINT "asset_variants_media_role" CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')),
	CONSTRAINT "asset_variants_usage" CHECK(`usage` IN ('preprocess', 'work-card', 'adoption-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'contact-qr')),
	CONSTRAINT "asset_variants_dimensions" CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK(`format` IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK(`quality` BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim(`crop_identity`)) > 0 AND length(trim(`recipe_version`)) > 0 AND length(trim(`watermark_profile`)) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK(`logo_digest` = 'none' OR (length(`logo_digest`) = 64 AND `logo_digest` = lower(`logo_digest`) AND `logo_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK(`watermark_anchor` IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
	CONSTRAINT "asset_variants_watermark_config_digest" CHECK(`watermark_config_digest` = 'none' OR (length(`watermark_config_digest`) = 64 AND `watermark_config_digest` = lower(`watermark_config_digest`) AND `watermark_config_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_protection_mode" CHECK(`protection_mode` IN ('none', 'watermark')),
	CONSTRAINT "asset_variants_unprotected_identity" CHECK(`protection_mode` != 'none' OR (`watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_site_display_recipe" CHECK(`recipe_version` NOT IN ('site-display-v1', 'site-display-v2') OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))),
	CONSTRAINT "asset_variants_site_display_usage" CHECK(`usage` NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` IN ('site-display-v1', 'site-display-v2'))),
	CONSTRAINT "asset_variants_public_protection" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` = 'watermark' OR `recipe_version` IN ('site-display-v1', 'site-display-v2', 'contact-qr-v1')),
	CONSTRAINT "asset_variants_commission_private" CHECK(`media_role` != 'commission_design_reference' OR `storage_scope` = 'PRIVATE'),
	CONSTRAINT "asset_variants_contact_qr_recipe" CHECK(`recipe_version` != 'contact-qr-v1' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` = 'contact-qr' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
	CONSTRAINT "asset_variants_contact_qr_usage" CHECK(`usage` != 'contact-qr' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` = 'contact-qr-v1' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
	CONSTRAINT "asset_variants_contact_qr_role" CHECK(`media_role` != 'contact_qr' OR `usage` IN ('preprocess', 'contact-qr')),
	CONSTRAINT "asset_variants_public_watermark" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` != 'watermark' OR ((`watermark_profile` = 'brand-standard-v1' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` != 'none' AND `watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL) OR (`watermark_profile` = 'brand-centered-v2' AND `watermark_profile_id` IS NOT NULL AND `watermark_config_digest` != 'none' AND `logo_digest` != 'none' AND `watermark_anchor` = 'center' AND `watermark_opacity_percent` BETWEEN 10 AND 90 AND `watermark_scale_percent` BETWEEN 20 AND 90))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK(`usage` != 'preprocess' OR (`storage_scope` = 'PRIVATE' AND `protection_mode` = 'none' AND `watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_private_unprotected" CHECK(`storage_scope` != 'PRIVATE' OR `protection_mode` = 'none'),
	CONSTRAINT "asset_variants_ready_output" CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_asset_variants` SELECT * FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_legacy_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`) WHERE `watermark_profile_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_profile_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile_id`,`watermark_config_digest`,`logo_digest`,`watermark_anchor`,`watermark_opacity_percent`,`watermark_scale_percent`) WHERE `watermark_profile_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE INDEX `asset_variants_protection_idx` ON `asset_variants` (`storage_scope`,`protection_mode`,`usage`,`status`);--> statement-breakpoint
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
    (NEW.`media_role` = 'studio_photo' AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
    OR (NEW.`media_role` = 'design_sheet' AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail', 'home-entry-adoption'))
    OR (NEW.`media_role` = 'adoption_cover' AND NEW.`usage` IN ('preprocess', 'adoption-card'))
    OR (NEW.`media_role` = 'commission_design_reference' AND NEW.`usage` = 'preprocess')
    OR (NEW.`media_role` = 'home_hero_landscape' AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait' AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'contact_qr' AND NEW.`usage` IN ('preprocess', 'contact-qr'))
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
  OR (NEW.`usage` = 'preprocess' AND (NEW.`width` > 4096 OR NEW.`height` > 4096 OR (NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)))
  OR (NEW.`source_variant_id` IS NULL AND NEW.`input_sha256` != (SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`))
  OR (NEW.`source_variant_id` IS NOT NULL AND NOT EXISTS (
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
  ))
  OR (NEW.`storage_scope` = 'PUBLIC'
    AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000
    AND NEW.`source_variant_id` IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN NEW.`usage` = 'preprocess' AND NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000
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

CREATE TABLE `commission_upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_digest` text NOT NULL,
	`private_object_key` text NOT NULL,
	`expected_content_type` text NOT NULL,
	`expected_bytes` integer NOT NULL,
	`expected_content_md5` text NOT NULL,
	`expected_sha256` text NOT NULL,
	`expected_width` integer NOT NULL,
	`expected_height` integer NOT NULL,
	`status` text DEFAULT 'AWAITING_UPLOAD' NOT NULL,
	`asset_id` text,
	`failure_code` text,
	`failure_stage` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	`consumed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "commission_upload_sessions_token_digest" CHECK(length(`token_digest`) = 64 AND `token_digest` = lower(`token_digest`) AND `token_digest` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "commission_upload_sessions_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "commission_upload_sessions_content_type" CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "commission_upload_sessions_expected_bytes" CHECK(`expected_bytes` BETWEEN 1 AND 20000000),
	CONSTRAINT "commission_upload_sessions_expected_md5" CHECK(length(`expected_content_md5`) = 24),
	CONSTRAINT "commission_upload_sessions_expected_sha256" CHECK(length(`expected_sha256`) = 64 AND `expected_sha256` = lower(`expected_sha256`) AND `expected_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "commission_upload_sessions_dimensions" CHECK(`expected_width` BETWEEN 64 AND 12000 AND `expected_height` BETWEEN 64 AND 12000),
	CONSTRAINT "commission_upload_sessions_status" CHECK(`status` IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'CONSUMED', 'FAILED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "commission_upload_sessions_asset_state" CHECK((`status` IN ('COMPLETED', 'CONSUMED') AND `asset_id` IS NOT NULL) OR (`status` NOT IN ('COMPLETED', 'CONSUMED') AND `asset_id` IS NULL)),
	CONSTRAINT "commission_upload_sessions_failure_state" CHECK((`status` = 'FAILED' AND `failure_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `failure_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "commission_upload_sessions_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')),
	CONSTRAINT "commission_upload_sessions_ttl" CHECK(`expires_at` > `created_at` AND `expires_at` <= `created_at` + 600000),
	CONSTRAINT "commission_upload_sessions_times" CHECK((`status` IN ('COMPLETED', 'CONSUMED')) = (`completed_at` IS NOT NULL) AND (`status` = 'CONSUMED') = (`consumed_at` IS NOT NULL)),
	CONSTRAINT "commission_upload_sessions_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_upload_sessions_token_unique` ON `commission_upload_sessions` (`token_digest`);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_upload_sessions_key_unique` ON `commission_upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_upload_sessions_asset_unique` ON `commission_upload_sessions` (`asset_id`) WHERE `asset_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `commission_upload_sessions_expiry_idx` ON `commission_upload_sessions` (`status`, `expires_at`);--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_identity_immutable`
BEFORE UPDATE OF
  `token_digest`, `private_object_key`, `expected_content_type`,
  `expected_bytes`, `expected_content_md5`, `expected_sha256`,
  `expected_width`, `expected_height`, `created_at`, `expires_at`
ON `commission_upload_sessions`
WHEN
  NEW.`token_digest` != OLD.`token_digest`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`expected_content_type` != OLD.`expected_content_type`
  OR NEW.`expected_bytes` != OLD.`expected_bytes`
  OR NEW.`expected_content_md5` != OLD.`expected_content_md5`
  OR NEW.`expected_sha256` != OLD.`expected_sha256`
  OR NEW.`expected_width` != OLD.`expected_width`
  OR NEW.`expected_height` != OLD.`expected_height`
  OR NEW.`created_at` != OLD.`created_at`
  OR NEW.`expires_at` != OLD.`expires_at`
BEGIN
  SELECT RAISE(ABORT, 'commission upload identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_completed_asset_insert`
BEFORE INSERT ON `commission_upload_sessions`
WHEN NEW.`status` IN ('COMPLETED', 'CONSUMED') AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission upload requires a ready private asset');
END;--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_completed_asset_update`
BEFORE UPDATE OF `status`, `asset_id` ON `commission_upload_sessions`
WHEN NEW.`status` IN ('COMPLETED', 'CONSUMED') AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission upload requires a ready private asset');
END;--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_status_transition`
BEFORE UPDATE OF `status` ON `commission_upload_sessions`
WHEN NEW.`status` != OLD.`status` AND NOT (
  (OLD.`status` = 'AWAITING_UPLOAD' AND NEW.`status` IN ('VALIDATING', 'CANCELLED', 'EXPIRED'))
  OR (OLD.`status` = 'VALIDATING' AND NEW.`status` IN ('COMPLETED', 'FAILED'))
  OR (OLD.`status` = 'COMPLETED' AND NEW.`status` = 'CONSUMED')
)
BEGIN
  SELECT RAISE(ABORT, 'invalid commission upload status transition');
END;--> statement-breakpoint

CREATE TABLE `commission_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_code` text NOT NULL,
	`nickname` text NOT NULL,
	`phone_country_code` text DEFAULT '+86' NOT NULL,
	`phone_number` text NOT NULL,
	`qq` text NOT NULL,
	`height_cm` integer NOT NULL,
	`weight_kg_tenths` integer NOT NULL,
	`design_asset_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`internal_note` text,
	`handled_at` integer,
	`handled_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`design_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "commission_submissions_receipt" CHECK(`receipt_code` = upper(`receipt_code`) AND length(`receipt_code`) BETWEEN 8 AND 24 AND `receipt_code` NOT GLOB '*[^A-Z0-9-]*'),
	CONSTRAINT "commission_submissions_nickname" CHECK(`nickname` = trim(`nickname`) AND length(`nickname`) BETWEEN 1 AND 50),
	CONSTRAINT "commission_submissions_country" CHECK(`phone_country_code` = '+86'),
	CONSTRAINT "commission_submissions_phone" CHECK(length(`phone_number`) = 11 AND `phone_number` GLOB '1[3-9]*' AND `phone_number` NOT GLOB '*[^0-9]*'),
	CONSTRAINT "commission_submissions_qq" CHECK(substr(`qq`, 1, 1) BETWEEN '1' AND '9' AND length(`qq`) BETWEEN 5 AND 12 AND `qq` NOT GLOB '*[^0-9]*'),
	CONSTRAINT "commission_submissions_height" CHECK(`height_cm` BETWEEN 80 AND 250),
	CONSTRAINT "commission_submissions_weight" CHECK(`weight_kg_tenths` BETWEEN 200 AND 3000),
	CONSTRAINT "commission_submissions_status" CHECK(`status` IN ('pending', 'accepted', 'rejected')),
	CONSTRAINT "commission_submissions_note" CHECK(`internal_note` IS NULL OR (`internal_note` = trim(`internal_note`) AND length(`internal_note`) BETWEEN 1 AND 2000)),
	CONSTRAINT "commission_submissions_handled" CHECK((`status` = 'pending' AND `handled_at` IS NULL AND `handled_by` IS NULL) OR (`status` IN ('accepted', 'rejected') AND `handled_at` IS NOT NULL AND `handled_by` IS NOT NULL)),
	CONSTRAINT "commission_submissions_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_submissions_receipt_unique` ON `commission_submissions` (`receipt_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_submissions_design_asset_unique` ON `commission_submissions` (`design_asset_id`);--> statement-breakpoint
CREATE INDEX `commission_submissions_status_created_idx` ON `commission_submissions` (`status`, `created_at`);--> statement-breakpoint
CREATE TRIGGER `commission_submissions_design_asset_insert`
BEFORE INSERT ON `commission_submissions`
WHEN NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`design_asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission submission requires a ready design reference');
END;--> statement-breakpoint
CREATE TRIGGER `commission_submissions_design_asset_update`
BEFORE UPDATE OF `design_asset_id` ON `commission_submissions`
WHEN NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`design_asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission submission requires a ready design reference');
END;--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_consumed_submission`
BEFORE UPDATE OF `status`, `asset_id` ON `commission_upload_sessions`
WHEN NEW.`status` = 'CONSUMED' AND NOT EXISTS (
  SELECT 1 FROM `commission_submissions`
  WHERE `design_asset_id` = NEW.`asset_id`
)
BEGIN
  SELECT RAISE(ABORT, 'consumed commission upload requires a submission');
END;--> statement-breakpoint

PRAGMA foreign_key_check;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
