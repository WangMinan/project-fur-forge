PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "asset_variants_media_role" CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')),
	CONSTRAINT "asset_variants_usage" CHECK(`usage` IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption')),
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
	CONSTRAINT "asset_variants_public_protection" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` = 'watermark' OR `recipe_version` = 'site-display-v1'),
	CONSTRAINT "asset_variants_public_watermark" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` != 'watermark' OR ((`watermark_profile` = 'brand-standard-v1' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` != 'none' AND `watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL) OR (`watermark_profile` = 'brand-centered-v2' AND `watermark_profile_id` IS NOT NULL AND `watermark_config_digest` != 'none' AND `logo_digest` != 'none' AND `watermark_anchor` = 'center' AND `watermark_opacity_percent` BETWEEN 10 AND 90 AND `watermark_scale_percent` BETWEEN 20 AND 90))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK(`usage` != 'preprocess' OR (`storage_scope` = 'PRIVATE' AND `protection_mode` = 'none' AND `watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_private_unprotected" CHECK(`storage_scope` != 'PRIVATE' OR `protection_mode` = 'none'),
	CONSTRAINT "asset_variants_ready_output" CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK(`version` > 0)
);
--> statement-breakpoint
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
	`format`, `quality`, `crop_identity`, `recipe_version`,
	CASE
		WHEN `storage_scope` = 'PRIVATE' OR `usage` = 'preprocess' THEN 'none'
		ELSE 'watermark'
	END,
	`watermark_profile`, `watermark_profile_id`, `watermark_config_digest`,
	`logo_digest`, `watermark_anchor`, `watermark_opacity_percent`,
	`watermark_scale_percent`, `sha256`, `byte_size`, `version`,
	`internal_error_code`, `created_at`, `updated_at`
FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
END;
--> statement-breakpoint
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
  )
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN
  NEW.`usage` = 'preprocess'
  AND NEW.`status` = 'READY'
  AND NEW.`byte_size` > 20000000
BEGIN
  SELECT RAISE(ABORT, 'preprocess variant exceeds OSS input limits');
END;
--> statement-breakpoint
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
END;
