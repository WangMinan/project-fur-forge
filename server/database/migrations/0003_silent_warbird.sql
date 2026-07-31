CREATE TABLE `upload_sessions` (
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
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_sessions_owner_type" CHECK("upload_sessions"."owner_type" IN ('work', 'site')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim("upload_sessions"."owner_id")) > 0 AND ("upload_sessions"."owner_type" != 'site' OR "upload_sessions"."owner_id" = 'home')),
	CONSTRAINT "upload_sessions_owner_version" CHECK("upload_sessions"."owner_version" >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK(("upload_sessions"."owner_type" = 'work' AND "upload_sessions"."media_role" IN ('design_sheet', 'studio_photo')) OR ("upload_sessions"."owner_type" = 'site' AND "upload_sessions"."media_role" IN ('home_hero_landscape', 'home_hero_portrait'))),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim("upload_sessions"."private_object_key")) > 0 AND instr("upload_sessions"."private_object_key", '://') = 0 AND substr("upload_sessions"."private_object_key", 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK("upload_sessions"."expected_content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_expected_bytes" CHECK("upload_sessions"."expected_bytes" BETWEEN 1 AND 30000000),
	CONSTRAINT "upload_sessions_expected_md5" CHECK(length("upload_sessions"."expected_content_md5") = 24),
	CONSTRAINT "upload_sessions_expected_sha256" CHECK(length("upload_sessions"."expected_sha256") = 64 AND "upload_sessions"."expected_sha256" = lower("upload_sessions"."expected_sha256") AND "upload_sessions"."expected_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "upload_sessions_expected_dimensions" CHECK("upload_sessions"."expected_width" BETWEEN 1 AND 12000 AND "upload_sessions"."expected_height" BETWEEN 1 AND 12000),
	CONSTRAINT "upload_sessions_status" CHECK("upload_sessions"."status" IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "upload_sessions_asset_state" CHECK(("upload_sessions"."status" = 'COMPLETED' AND "upload_sessions"."asset_id" IS NOT NULL) OR ("upload_sessions"."status" != 'COMPLETED' AND "upload_sessions"."asset_id" IS NULL)),
	CONSTRAINT "upload_sessions_failure_state" CHECK(("upload_sessions"."status" = 'FAILED' AND "upload_sessions"."failure_code" IS NOT NULL) OR ("upload_sessions"."status" != 'FAILED' AND "upload_sessions"."failure_code" IS NULL)),
	CONSTRAINT "upload_sessions_expiry" CHECK("upload_sessions"."expires_at" = "upload_sessions"."created_at" + 300000),
	CONSTRAINT "upload_sessions_version_positive" CHECK("upload_sessions"."version" > 0)
);
--> statement-breakpoint
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
      SELECT 1
      FROM `works`
      WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
        AND (
          NEW.`media_role` != 'design_sheet'
          OR `purpose` = 'adoption'
        )
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'),
      0
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
