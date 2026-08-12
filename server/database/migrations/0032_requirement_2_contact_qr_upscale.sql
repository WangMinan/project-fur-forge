-- T15-F3：联系二维码接受 PNG/JPEG/WebP 与任意长宽比，交由 FFmpeg 适配。
-- SQLite 不能原地修改 CHECK，因此只重建受影响的 assets/upload_sessions；
-- 已有原图、上传会话与外键关系原样复制，旧迁移保持不可变。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- 保留其它表上引用 assets/upload_sessions 的全部现有触发器；只重建表自身触发器。
PRAGMA legacy_alter_table=ON;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_original_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint

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
	CONSTRAINT "assets_role" CHECK(`role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo', 'return_photo', 'contact_qr')),
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
	CONSTRAINT "assets_contact_qr_source" CHECK(`role` != 'contact_qr' OR (`mime_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `byte_size` <= 20000000 AND `width` >= 64 AND `height` >= 64 AND `fit_mode` = 'contain')),
	CONSTRAINT "assets_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_assets` SELECT * FROM `assets`;--> statement-breakpoint
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
	`cleaned_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_sessions_owner_type" CHECK(`owner_type` IN ('work', 'site', 'return')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim(`owner_id`)) > 0 AND (`owner_type` != 'site' OR `owner_id` IN ('home', 'branding', 'contact'))),
	CONSTRAINT "upload_sessions_owner_version" CHECK(`owner_version` >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo')) OR (`owner_type` = 'site' AND `owner_id` = 'home' AND `media_role` IN ('home_hero_landscape', 'home_hero_portrait')) OR (`owner_type` = 'site' AND `owner_id` = 'branding' AND `media_role` = 'watermark_logo') OR (`owner_type` = 'site' AND `owner_id` = 'contact' AND `media_role` = 'contact_qr') OR (`owner_type` = 'return' AND `media_role` = 'return_photo')),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_watermark_logo_png" CHECK(`media_role` != 'watermark_logo' OR (`expected_content_type` = 'image/png' AND `expected_bytes` <= 20000000)),
	CONSTRAINT "upload_sessions_contact_qr_source" CHECK(`media_role` != 'contact_qr' OR (`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `expected_bytes` <= 20000000 AND `expected_width` >= 64 AND `expected_height` >= 64)),
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
  NEW.`status` != 'READY' OR NEW.`role` != OLD.`role`
) AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1
    AND (`landscape_asset_id` = OLD.`id` OR `portrait_asset_id` = OLD.`id`)
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide requires READY assets');
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
    NEW.`owner_type` = 'work' AND NOT EXISTS (
      SELECT 1 FROM `works` WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
        AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
    )
  )
  OR (
    NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'home'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0
    )
  )
  OR (
    NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (
      SELECT `version` FROM `site_branding` WHERE `id` = 'site'
    )
  )
  OR (
    NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'contact'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `contact_content_version` FROM `site_content` WHERE `id` = 'site'), 0
    )
  )
  OR (
    NEW.`owner_type` = 'return' AND NOT EXISTS (
      SELECT 1 FROM `return_characters` WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
