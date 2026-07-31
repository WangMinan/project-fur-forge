PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim("__new_upload_sessions"."owner_id")) > 0 AND ("__new_upload_sessions"."owner_type" != 'site' OR "__new_upload_sessions"."owner_id" = 'home')),
	CONSTRAINT "upload_sessions_owner_version" CHECK("__new_upload_sessions"."owner_version" >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK(("__new_upload_sessions"."owner_type" = 'work' AND "__new_upload_sessions"."media_role" IN ('design_sheet', 'studio_photo')) OR ("__new_upload_sessions"."owner_type" = 'site' AND "__new_upload_sessions"."media_role" IN ('home_hero_landscape', 'home_hero_portrait'))),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim("__new_upload_sessions"."private_object_key")) > 0 AND instr("__new_upload_sessions"."private_object_key", '://') = 0 AND substr("__new_upload_sessions"."private_object_key", 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK("__new_upload_sessions"."expected_content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
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
INSERT INTO `__new_upload_sessions`("id", "owner_type", "owner_id", "owner_version", "media_role", "private_object_key", "expected_content_type", "expected_bytes", "expected_content_md5", "expected_sha256", "expected_width", "expected_height", "created_by", "status", "asset_id", "version", "failure_code", "failure_stage", "created_at", "expires_at", "updated_at") SELECT "id", "owner_type", "owner_id", "owner_version", "media_role", "private_object_key", "expected_content_type", "expected_bytes", "expected_content_md5", "expected_sha256", "expected_width", "expected_height", "created_by", "status", "asset_id", "version", "failure_code", CASE WHEN "status" = 'FAILED' THEN 'HEAD' ELSE NULL END, "created_at", "expires_at", "updated_at" FROM `upload_sessions`;--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);--> statement-breakpoint
DROP TRIGGER `asset_variants_role_insert`;--> statement-breakpoint
DROP TRIGGER `asset_variants_role_usage_insert`;--> statement-breakpoint
DROP TRIGGER `asset_variants_source_insert`;--> statement-breakpoint
DROP TRIGGER `work_assets_role_insert`;--> statement-breakpoint
DROP TRIGGER `work_assets_role_update`;--> statement-breakpoint
DROP TRIGGER `site_hero_slides_ready_insert`;--> statement-breakpoint
DROP TRIGGER `site_hero_slides_ready_update`;--> statement-breakpoint
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
	CONSTRAINT "assets_role" CHECK("__new_assets"."role" IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')),
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
	CONSTRAINT "assets_version_positive" CHECK("__new_assets"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_assets`("id", "role", "status", "private_object_key", "sha256", "byte_size", "mime_type", "width", "height", "exif_orientation", "focal_x", "focal_y", "fit_mode", "watermark_anchor", "version", "internal_error_code", "created_at", "updated_at") SELECT "id", "role", "status", "private_object_key", "sha256", "byte_size", "mime_type", "width", "height", 1, 0.5, 0.5, 'cover', 'top-left', "version", "internal_error_code", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);
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
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0
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
CREATE TRIGGER `asset_variants_role_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`media_role` != (
  SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`
)
BEGIN
  SELECT RAISE(ABORT, 'variant role must match original asset role');
END;
--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  NEW.`media_role` != (
    SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`
  )
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
    AND (
      SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`
    ) > 20000000
    AND NEW.`source_variant_id` IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
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
