CREATE TABLE `site_branding` (
	`id` text PRIMARY KEY DEFAULT 'site' NOT NULL,
	`active_watermark_profile_id` text,
	`draft_watermark_profile_id` text,
	`last_watermark_operation_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_watermark_profile_id`) REFERENCES `watermark_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`draft_watermark_profile_id`) REFERENCES `watermark_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`last_watermark_operation_id`) REFERENCES `watermark_operations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "site_branding_singleton" CHECK("site_branding"."id" = 'site'),
	CONSTRAINT "site_branding_profile_distinct" CHECK("site_branding"."active_watermark_profile_id" IS NULL OR "site_branding"."draft_watermark_profile_id" IS NULL OR "site_branding"."active_watermark_profile_id" != "site_branding"."draft_watermark_profile_id"),
	CONSTRAINT "site_branding_version_positive" CHECK("site_branding"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE `watermark_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_type` text NOT NULL,
	`profile_id` text NOT NULL,
	`branding_version` integer NOT NULL,
	`status` text NOT NULL,
	`affected_work_count` integer DEFAULT 0 NOT NULL,
	`affected_hero_slide_count` integer DEFAULT 0 NOT NULL,
	`target_variant_count` integer DEFAULT 0 NOT NULL,
	`generated_variant_count` integer DEFAULT 0 NOT NULL,
	`verified_variant_count` integer DEFAULT 0 NOT NULL,
	`preview_manifest_json` text DEFAULT '[]' NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`internal_error_code` text,
	`failure_stage` text,
	`version` integer DEFAULT 1 NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `watermark_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "watermark_operations_type" CHECK("watermark_operations"."operation_type" IN ('WATERMARK_PREVIEW', 'WATERMARK_REBUILD')),
	CONSTRAINT "watermark_operations_status" CHECK("watermark_operations"."status" IN ('GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'SWITCHING_PROFILE', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "watermark_operations_counts" CHECK("watermark_operations"."branding_version" >= 0 AND "watermark_operations"."affected_work_count" >= 0 AND "watermark_operations"."affected_hero_slide_count" >= 0 AND "watermark_operations"."target_variant_count" >= 0 AND "watermark_operations"."generated_variant_count" >= 0 AND "watermark_operations"."verified_variant_count" >= 0),
	CONSTRAINT "watermark_operations_failure_state" CHECK(("watermark_operations"."status" = 'FAILED' AND "watermark_operations"."internal_error_code" IS NOT NULL AND "watermark_operations"."failure_stage" IS NOT NULL) OR ("watermark_operations"."status" != 'FAILED' AND "watermark_operations"."internal_error_code" IS NULL AND "watermark_operations"."failure_stage" IS NULL)),
	CONSTRAINT "watermark_operations_version_positive" CHECK("watermark_operations"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `watermark_operations_profile_idx` ON `watermark_operations` (`profile_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `watermark_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_name` text NOT NULL,
	`source_asset_id` text NOT NULL,
	`logo_digest` text NOT NULL,
	`position` text DEFAULT 'center' NOT NULL,
	`opacity_percent` integer DEFAULT 50 NOT NULL,
	`scale_percent` integer DEFAULT 60 NOT NULL,
	`config_digest` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "watermark_profiles_name" CHECK("watermark_profiles"."profile_name" = 'brand-centered-v2'),
	CONSTRAINT "watermark_profiles_position" CHECK("watermark_profiles"."position" = 'center'),
	CONSTRAINT "watermark_profiles_opacity" CHECK("watermark_profiles"."opacity_percent" BETWEEN 10 AND 90),
	CONSTRAINT "watermark_profiles_scale" CHECK("watermark_profiles"."scale_percent" BETWEEN 20 AND 90),
	CONSTRAINT "watermark_profiles_logo_digest" CHECK(length("watermark_profiles"."logo_digest") = 64 AND "watermark_profiles"."logo_digest" = lower("watermark_profiles"."logo_digest") AND "watermark_profiles"."logo_digest" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "watermark_profiles_config_digest" CHECK(length("watermark_profiles"."config_digest") = 64 AND "watermark_profiles"."config_digest" = lower("watermark_profiles"."config_digest") AND "watermark_profiles"."config_digest" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "watermark_profiles_status" CHECK("watermark_profiles"."status" IN ('DRAFT', 'APPLYING', 'ACTIVE', 'RETIRED', 'FAILED')),
	CONSTRAINT "watermark_profiles_version_positive" CHECK("watermark_profiles"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `watermark_profiles_config_digest_idx` ON `watermark_profiles` (`config_digest`);--> statement-breakpoint
CREATE INDEX `watermark_profiles_source_asset_idx` ON `watermark_profiles` (`source_asset_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_role_usage_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_source_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preprocess_limit_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preserve_source`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_original_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_update`;--> statement-breakpoint
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
	CONSTRAINT "asset_variants_usage" CHECK("__new_asset_variants"."usage" IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait')),
	CONSTRAINT "asset_variants_dimensions" CHECK("__new_asset_variants"."width" BETWEEN 1 AND 12000 AND "__new_asset_variants"."height" BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK("__new_asset_variants"."format" IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK("__new_asset_variants"."quality" BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim("__new_asset_variants"."crop_identity")) > 0 AND length(trim("__new_asset_variants"."recipe_version")) > 0 AND length(trim("__new_asset_variants"."watermark_profile")) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK("__new_asset_variants"."logo_digest" = 'none' OR (length("__new_asset_variants"."logo_digest") = 64 AND "__new_asset_variants"."logo_digest" = lower("__new_asset_variants"."logo_digest") AND "__new_asset_variants"."logo_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK("__new_asset_variants"."watermark_anchor" IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
	CONSTRAINT "asset_variants_watermark_config_digest" CHECK("__new_asset_variants"."watermark_config_digest" = 'none' OR (length("__new_asset_variants"."watermark_config_digest") = 64 AND "__new_asset_variants"."watermark_config_digest" = lower("__new_asset_variants"."watermark_config_digest") AND "__new_asset_variants"."watermark_config_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_public_watermark" CHECK("__new_asset_variants"."storage_scope" != 'PUBLIC' OR (("__new_asset_variants"."watermark_profile" = 'brand-standard-v1' AND "__new_asset_variants"."watermark_profile_id" IS NULL AND "__new_asset_variants"."watermark_config_digest" = 'none' AND "__new_asset_variants"."logo_digest" != 'none' AND "__new_asset_variants"."watermark_anchor" IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND "__new_asset_variants"."watermark_opacity_percent" IS NULL AND "__new_asset_variants"."watermark_scale_percent" IS NULL) OR ("__new_asset_variants"."watermark_profile" = 'brand-centered-v2' AND "__new_asset_variants"."watermark_profile_id" IS NOT NULL AND "__new_asset_variants"."watermark_config_digest" != 'none' AND "__new_asset_variants"."logo_digest" != 'none' AND "__new_asset_variants"."watermark_anchor" = 'center' AND "__new_asset_variants"."watermark_opacity_percent" BETWEEN 10 AND 90 AND "__new_asset_variants"."watermark_scale_percent" BETWEEN 20 AND 90))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK("__new_asset_variants"."usage" != 'preprocess' OR ("__new_asset_variants"."storage_scope" = 'PRIVATE' AND "__new_asset_variants"."watermark_profile" = 'none' AND "__new_asset_variants"."watermark_profile_id" IS NULL AND "__new_asset_variants"."watermark_config_digest" = 'none' AND "__new_asset_variants"."logo_digest" = 'none' AND "__new_asset_variants"."watermark_anchor" = 'none' AND "__new_asset_variants"."watermark_opacity_percent" IS NULL AND "__new_asset_variants"."watermark_scale_percent" IS NULL)),
	CONSTRAINT "asset_variants_ready_output" CHECK("__new_asset_variants"."status" != 'READY' OR ("__new_asset_variants"."sha256" IS NOT NULL AND length("__new_asset_variants"."sha256") = 64 AND "__new_asset_variants"."byte_size" > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK("__new_asset_variants"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_asset_variants`("id", "asset_id", "source_variant_id", "storage_scope", "status", "object_key", "input_sha256", "media_role", "usage", "width", "height", "format", "quality", "crop_identity", "recipe_version", "watermark_profile", "watermark_profile_id", "watermark_config_digest", "logo_digest", "watermark_anchor", "watermark_opacity_percent", "watermark_scale_percent", "sha256", "byte_size", "version", "internal_error_code", "created_at", "updated_at") SELECT "id", "asset_id", "source_variant_id", "storage_scope", "status", "object_key", "input_sha256", "media_role", "usage", "width", "height", "format", "quality", "crop_identity", "recipe_version", "watermark_profile", NULL, 'none', "logo_digest", "watermark_anchor", NULL, NULL, "sha256", "byte_size", "version", "internal_error_code", "created_at", "updated_at" FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_legacy_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`) WHERE "asset_variants"."watermark_profile_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_profile_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile_id`,`watermark_config_digest`,`logo_digest`,`watermark_anchor`,`watermark_opacity_percent`,`watermark_scale_percent`) WHERE "asset_variants"."watermark_profile_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
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
	CONSTRAINT "assets_role" CHECK("__new_assets"."role" IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo')),
	CONSTRAINT "assets_status" CHECK("__new_assets"."status" IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "assets_private_key_relative" CHECK(length(trim("__new_assets"."private_object_key")) > 0 AND instr("__new_assets"."private_object_key", '://') = 0 AND substr("__new_assets"."private_object_key", 1, 1) != '/'),
	CONSTRAINT "assets_sha256" CHECK(length("__new_assets"."sha256") = 64 AND "__new_assets"."sha256" = lower("__new_assets"."sha256") AND "__new_assets"."sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "assets_byte_size" CHECK("__new_assets"."byte_size" BETWEEN 1 AND 30000000),
	CONSTRAINT "assets_dimensions" CHECK("__new_assets"."width" BETWEEN 1 AND 12000 AND "__new_assets"."height" BETWEEN 1 AND 12000),
	CONSTRAINT "assets_exif_orientation" CHECK("__new_assets"."exif_orientation" BETWEEN 1 AND 8),
	CONSTRAINT "assets_focus" CHECK("__new_assets"."focal_x" BETWEEN 0 AND 1 AND "__new_assets"."focal_y" BETWEEN 0 AND 1),
	CONSTRAINT "assets_fit_mode" CHECK("__new_assets"."fit_mode" IN ('cover', 'contain')),
	CONSTRAINT "assets_watermark_anchor" CHECK("__new_assets"."watermark_anchor" IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
	CONSTRAINT "assets_hero_orientation" CHECK(("__new_assets"."role" != 'home_hero_landscape' OR "__new_assets"."width" > "__new_assets"."height") AND ("__new_assets"."role" != 'home_hero_portrait' OR "__new_assets"."height" > "__new_assets"."width")),
	CONSTRAINT "assets_mime_type" CHECK("__new_assets"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_watermark_logo_png" CHECK("__new_assets"."role" != 'watermark_logo' OR ("__new_assets"."mime_type" = 'image/png' AND "__new_assets"."byte_size" <= 20000000)),
	CONSTRAINT "assets_version_positive" CHECK("__new_assets"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "role", "status", "private_object_key", "sha256", "byte_size", "mime_type", "width", "height", "exif_orientation", "focal_x", "focal_y", "fit_mode", "watermark_anchor", "version", "internal_error_code", "created_at", "updated_at") SELECT "id", "role", "status", "private_object_key", "sha256", "byte_size", "mime_type", "width", "height", "exif_orientation", "focal_x", "focal_y", "fit_mode", "watermark_anchor", "version", "internal_error_code", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
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
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_sessions_owner_type" CHECK("__new_upload_sessions"."owner_type" IN ('work', 'site')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim("__new_upload_sessions"."owner_id")) > 0 AND ("__new_upload_sessions"."owner_type" != 'site' OR "__new_upload_sessions"."owner_id" IN ('home', 'branding'))),
	CONSTRAINT "upload_sessions_owner_version" CHECK("__new_upload_sessions"."owner_version" >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK(("__new_upload_sessions"."owner_type" = 'work' AND "__new_upload_sessions"."media_role" IN ('design_sheet', 'studio_photo')) OR ("__new_upload_sessions"."owner_type" = 'site' AND "__new_upload_sessions"."owner_id" = 'home' AND "__new_upload_sessions"."media_role" IN ('home_hero_landscape', 'home_hero_portrait')) OR ("__new_upload_sessions"."owner_type" = 'site' AND "__new_upload_sessions"."owner_id" = 'branding' AND "__new_upload_sessions"."media_role" = 'watermark_logo')),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim("__new_upload_sessions"."private_object_key")) > 0 AND instr("__new_upload_sessions"."private_object_key", '://') = 0 AND substr("__new_upload_sessions"."private_object_key", 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK("__new_upload_sessions"."expected_content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_watermark_logo_png" CHECK("__new_upload_sessions"."media_role" != 'watermark_logo' OR ("__new_upload_sessions"."expected_content_type" = 'image/png' AND "__new_upload_sessions"."expected_bytes" <= 20000000)),
	CONSTRAINT "upload_sessions_expected_bytes" CHECK("__new_upload_sessions"."expected_bytes" BETWEEN 1 AND 30000000),
	CONSTRAINT "upload_sessions_expected_md5" CHECK(length("__new_upload_sessions"."expected_content_md5") = 24),
	CONSTRAINT "upload_sessions_expected_sha256" CHECK(length("__new_upload_sessions"."expected_sha256") = 64 AND "__new_upload_sessions"."expected_sha256" = lower("__new_upload_sessions"."expected_sha256") AND "__new_upload_sessions"."expected_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "upload_sessions_expected_dimensions" CHECK("__new_upload_sessions"."expected_width" BETWEEN 1 AND 12000 AND "__new_upload_sessions"."expected_height" BETWEEN 1 AND 12000),
	CONSTRAINT "upload_sessions_status" CHECK("__new_upload_sessions"."status" IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "upload_sessions_asset_state" CHECK(("__new_upload_sessions"."status" = 'COMPLETED' AND "__new_upload_sessions"."asset_id" IS NOT NULL) OR ("__new_upload_sessions"."status" != 'COMPLETED' AND "__new_upload_sessions"."asset_id" IS NULL)),
	CONSTRAINT "upload_sessions_failure_state" CHECK(("__new_upload_sessions"."status" = 'FAILED' AND "__new_upload_sessions"."failure_code" IS NOT NULL AND "__new_upload_sessions"."failure_stage" IS NOT NULL) OR ("__new_upload_sessions"."status" != 'FAILED' AND "__new_upload_sessions"."failure_code" IS NULL AND "__new_upload_sessions"."failure_stage" IS NULL)),
	CONSTRAINT "upload_sessions_failure_stage" CHECK("__new_upload_sessions"."failure_stage" IS NULL OR "__new_upload_sessions"."failure_stage" IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')),
	CONSTRAINT "upload_sessions_expiry" CHECK("__new_upload_sessions"."expires_at" = "__new_upload_sessions"."created_at" + 300000),
	CONSTRAINT "upload_sessions_version_positive" CHECK("__new_upload_sessions"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_upload_sessions`("id", "owner_type", "owner_id", "owner_version", "media_role", "private_object_key", "expected_content_type", "expected_bytes", "expected_content_md5", "expected_sha256", "expected_width", "expected_height", "created_by", "status", "asset_id", "version", "failure_code", "failure_stage", "created_at", "expires_at", "updated_at") SELECT "id", "owner_type", "owner_id", "owner_version", "media_role", "private_object_key", "expected_content_type", "expected_bytes", "expected_content_md5", "expected_sha256", "expected_width", "expected_height", "created_by", "status", "asset_id", "version", "failure_code", "failure_stage", "created_at", "expires_at", "updated_at" FROM `upload_sessions`;--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);
--> statement-breakpoint
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
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
CREATE TRIGGER `watermark_profiles_identity_immutable`
BEFORE UPDATE OF
  `profile_name`, `source_asset_id`, `logo_digest`, `position`,
  `opacity_percent`, `scale_percent`, `config_digest`
ON `watermark_profiles`
WHEN
  OLD.`status` != 'DRAFT'
  OR NEW.`status` != 'DRAFT'
  OR NEW.`profile_name` != OLD.`profile_name`
  OR NEW.`source_asset_id` != OLD.`source_asset_id`
  OR NEW.`logo_digest` != OLD.`logo_digest`
  OR NEW.`position` != OLD.`position`
  OR NEW.`opacity_percent` != OLD.`opacity_percent`
  OR NEW.`scale_percent` != OLD.`scale_percent`
  OR NEW.`config_digest` != OLD.`config_digest`
BEGIN
  SELECT RAISE(ABORT, 'watermark profile identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `watermark_profiles_status_transition`
BEFORE UPDATE OF `status` ON `watermark_profiles`
WHEN NOT (
  NEW.`status` = OLD.`status`
  OR (OLD.`status` = 'DRAFT' AND NEW.`status` IN ('APPLYING', 'ACTIVE', 'FAILED'))
  OR (OLD.`status` = 'APPLYING' AND NEW.`status` IN ('ACTIVE', 'FAILED'))
  OR (OLD.`status` = 'FAILED' AND NEW.`status` = 'APPLYING')
  OR (OLD.`status` = 'ACTIVE' AND NEW.`status` = 'RETIRED')
)
BEGIN
  SELECT RAISE(ABORT, 'watermark profile status transition is invalid');
END;
--> statement-breakpoint
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
      AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail'))
    OR (NEW.`media_role` = 'home_hero_landscape'
      AND NEW.`usage` IN ('preprocess', 'home-hero-landscape'))
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
CREATE TRIGGER `site_branding_profile_insert`
BEFORE INSERT ON `site_branding`
WHEN
  (NEW.`active_watermark_profile_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `watermark_profiles`
    WHERE `id` = NEW.`active_watermark_profile_id` AND `status` = 'ACTIVE'
  ))
  OR (NEW.`draft_watermark_profile_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `watermark_profiles`
    WHERE `id` = NEW.`draft_watermark_profile_id`
      AND `status` IN ('DRAFT', 'APPLYING', 'FAILED')
  ))
BEGIN
  SELECT RAISE(ABORT, 'site branding profile state is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `site_branding_profile_update`
BEFORE UPDATE OF `active_watermark_profile_id`, `draft_watermark_profile_id`
ON `site_branding`
WHEN
  (NEW.`active_watermark_profile_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `watermark_profiles`
    WHERE `id` = NEW.`active_watermark_profile_id` AND `status` = 'ACTIVE'
  ))
  OR (NEW.`draft_watermark_profile_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `watermark_profiles`
    WHERE `id` = NEW.`draft_watermark_profile_id`
      AND `status` IN ('DRAFT', 'APPLYING', 'FAILED')
  ))
BEGIN
  SELECT RAISE(ABORT, 'site branding profile state is invalid');
END;
--> statement-breakpoint
INSERT INTO `site_branding` (`id`, `version`, `created_at`, `updated_at`)
VALUES ('site', 1, unixepoch() * 1000, unixepoch() * 1000);
