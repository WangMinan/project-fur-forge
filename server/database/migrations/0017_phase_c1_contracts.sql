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
	CONSTRAINT "asset_variants_storage_scope" CHECK("__new_asset_variants"."storage_scope" IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "asset_variants_status" CHECK("__new_asset_variants"."status" IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "asset_variants_key_relative" CHECK(length(trim("__new_asset_variants"."object_key")) > 0 AND instr("__new_asset_variants"."object_key", '://') = 0 AND substr("__new_asset_variants"."object_key", 1, 1) != '/'),
	CONSTRAINT "asset_variants_input_sha256" CHECK(length("__new_asset_variants"."input_sha256") = 64 AND "__new_asset_variants"."input_sha256" = lower("__new_asset_variants"."input_sha256") AND "__new_asset_variants"."input_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "asset_variants_media_role" CHECK("__new_asset_variants"."media_role" IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')),
	CONSTRAINT "asset_variants_usage" CHECK("__new_asset_variants"."usage" IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'home-entry-commission', 'home-entry-adoption')),
	CONSTRAINT "asset_variants_dimensions" CHECK("__new_asset_variants"."width" BETWEEN 1 AND 12000 AND "__new_asset_variants"."height" BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK("__new_asset_variants"."format" IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK("__new_asset_variants"."quality" BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim("__new_asset_variants"."crop_identity")) > 0 AND length(trim("__new_asset_variants"."recipe_version")) > 0 AND length(trim("__new_asset_variants"."watermark_profile")) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK("__new_asset_variants"."logo_digest" = 'none' OR (length("__new_asset_variants"."logo_digest") = 64 AND "__new_asset_variants"."logo_digest" = lower("__new_asset_variants"."logo_digest") AND "__new_asset_variants"."logo_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK("__new_asset_variants"."watermark_anchor" IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
	CONSTRAINT "asset_variants_watermark_config_digest" CHECK("__new_asset_variants"."watermark_config_digest" = 'none' OR (length("__new_asset_variants"."watermark_config_digest") = 64 AND "__new_asset_variants"."watermark_config_digest" = lower("__new_asset_variants"."watermark_config_digest") AND "__new_asset_variants"."watermark_config_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_public_watermark" CHECK("__new_asset_variants"."storage_scope" != 'PUBLIC' OR ((("__new_asset_variants"."recipe_version" = 'site-display-v1' AND "__new_asset_variants"."usage" IN ('home-hero-landscape', 'home-hero-portrait', 'home-entry-commission', 'home-entry-adoption') AND "__new_asset_variants"."watermark_profile" = 'none' AND "__new_asset_variants"."watermark_profile_id" IS NULL AND "__new_asset_variants"."watermark_config_digest" = 'none' AND "__new_asset_variants"."logo_digest" = 'none' AND "__new_asset_variants"."watermark_anchor" = 'none' AND "__new_asset_variants"."watermark_opacity_percent" IS NULL AND "__new_asset_variants"."watermark_scale_percent" IS NULL) OR ("__new_asset_variants"."watermark_profile" = 'brand-standard-v1' AND "__new_asset_variants"."watermark_profile_id" IS NULL AND "__new_asset_variants"."watermark_config_digest" = 'none' AND "__new_asset_variants"."logo_digest" != 'none' AND "__new_asset_variants"."watermark_anchor" IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND "__new_asset_variants"."watermark_opacity_percent" IS NULL AND "__new_asset_variants"."watermark_scale_percent" IS NULL) OR ("__new_asset_variants"."watermark_profile" = 'brand-centered-v2' AND "__new_asset_variants"."watermark_profile_id" IS NOT NULL AND "__new_asset_variants"."watermark_config_digest" != 'none' AND "__new_asset_variants"."logo_digest" != 'none' AND "__new_asset_variants"."watermark_anchor" = 'center' AND "__new_asset_variants"."watermark_opacity_percent" BETWEEN 10 AND 90 AND "__new_asset_variants"."watermark_scale_percent" BETWEEN 20 AND 90)))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK("__new_asset_variants"."usage" != 'preprocess' OR ("__new_asset_variants"."storage_scope" = 'PRIVATE' AND "__new_asset_variants"."watermark_profile" = 'none' AND "__new_asset_variants"."watermark_profile_id" IS NULL AND "__new_asset_variants"."watermark_config_digest" = 'none' AND "__new_asset_variants"."logo_digest" = 'none' AND "__new_asset_variants"."watermark_anchor" = 'none' AND "__new_asset_variants"."watermark_opacity_percent" IS NULL AND "__new_asset_variants"."watermark_scale_percent" IS NULL)),
	CONSTRAINT "asset_variants_ready_output" CHECK("__new_asset_variants"."status" != 'READY' OR ("__new_asset_variants"."sha256" IS NOT NULL AND length("__new_asset_variants"."sha256") = 64 AND "__new_asset_variants"."byte_size" > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK("__new_asset_variants"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_asset_variants`("id", "asset_id", "source_variant_id", "storage_scope", "status", "object_key", "input_sha256", "media_role", "usage", "width", "height", "format", "quality", "crop_identity", "recipe_version", "watermark_profile", "watermark_profile_id", "watermark_config_digest", "logo_digest", "watermark_anchor", "watermark_opacity_percent", "watermark_scale_percent", "sha256", "byte_size", "version", "internal_error_code", "created_at", "updated_at") SELECT "id", "asset_id", "source_variant_id", "storage_scope", "status", "object_key", "input_sha256", "media_role", "usage", "width", "height", "format", "quality", "crop_identity", "recipe_version", "watermark_profile", "watermark_profile_id", "watermark_config_digest", "logo_digest", "watermark_anchor", "watermark_opacity_percent", "watermark_scale_percent", "sha256", "byte_size", "version", "internal_error_code", "created_at", "updated_at" FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_legacy_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`) WHERE `watermark_profile_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_profile_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile_id`,`watermark_config_digest`,`logo_digest`,`watermark_anchor`,`watermark_opacity_percent`,`watermark_scale_percent`) WHERE `watermark_profile_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF
  `asset_id`, `source_variant_id`, `storage_scope`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`,
  `quality`, `crop_identity`, `recipe_version`, `watermark_profile`,
  `watermark_profile_id`, `watermark_config_digest`, `logo_digest`,
  `watermark_anchor`, `watermark_opacity_percent`, `watermark_scale_percent`
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
      AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait'
      AND NEW.`usage` IN ('preprocess', 'home-hero-portrait'))
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
--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `commission_version` integer DEFAULT 1 NOT NULL CHECK (`commission_version` > 0);--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `faq_version` integer DEFAULT 1 NOT NULL CHECK (`faq_version` > 0);--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `about_version` integer DEFAULT 1 NOT NULL CHECK (`about_version` > 0);--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `terms_version` integer DEFAULT 1 NOT NULL CHECK (`terms_version` > 0);--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `privacy_version` integer DEFAULT 1 NOT NULL CHECK (`privacy_version` > 0);--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `contact_version` integer DEFAULT 1 NOT NULL CHECK (`contact_version` > 0);--> statement-breakpoint
ALTER TABLE `publication_operations` ADD COLUMN `attempt` integer DEFAULT 1 NOT NULL CHECK (`attempt` > 0);--> statement-breakpoint
ALTER TABLE `publication_operations` ADD COLUMN `heartbeat_at` integer DEFAULT 0 NOT NULL CHECK (`heartbeat_at` >= 0);--> statement-breakpoint
ALTER TABLE `publication_operations` ADD COLUMN `lease_expires_at` integer DEFAULT 0 NOT NULL CHECK (`lease_expires_at` >= `heartbeat_at`);--> statement-breakpoint
UPDATE `publication_operations` SET `heartbeat_at` = `updated_at`, `lease_expires_at` = `updated_at`;--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD COLUMN `attempt` integer DEFAULT 1 NOT NULL CHECK (`attempt` > 0);--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD COLUMN `heartbeat_at` integer DEFAULT 0 NOT NULL CHECK (`heartbeat_at` >= 0);--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD COLUMN `lease_expires_at` integer DEFAULT 0 NOT NULL CHECK (`lease_expires_at` >= `heartbeat_at`);--> statement-breakpoint
UPDATE `watermark_operations` SET `heartbeat_at` = `updated_at`, `lease_expires_at` = `updated_at`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
