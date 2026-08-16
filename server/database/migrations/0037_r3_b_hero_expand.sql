-- R3-B/T08-T09: add four independent Hero collection concurrency domains and
-- deterministically split each legacy landscape/portrait pair into two items.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

CREATE TABLE `site_hero_collections` (
	`placement` text NOT NULL,
	`orientation` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY (`placement`, `orientation`),
	CONSTRAINT "site_hero_collections_placement" CHECK(`placement` IN ('home', 'commission')),
	CONSTRAINT "site_hero_collections_orientation" CHECK(`orientation` IN ('landscape', 'portrait')),
	CONSTRAINT "site_hero_collections_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `site_hero_collections` (`placement`, `orientation`, `version`, `created_at`, `updated_at`)
VALUES
	('home', 'landscape', 1, unixepoch() * 1000, unixepoch() * 1000),
	('home', 'portrait', 1, unixepoch() * 1000, unixepoch() * 1000),
	('commission', 'landscape', 1, unixepoch() * 1000, unixepoch() * 1000),
	('commission', 'portrait', 1, unixepoch() * 1000, unixepoch() * 1000);--> statement-breakpoint

CREATE TABLE `site_hero_items` (
	`id` text PRIMARY KEY NOT NULL,
	`placement` text NOT NULL,
	`orientation` text NOT NULL,
	`asset_id` text NOT NULL,
	`alt_text` text NOT NULL,
	`sort_order` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`preview_object_key` text,
	`preview_expires_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`placement`, `orientation`) REFERENCES `site_hero_collections`(`placement`, `orientation`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "site_hero_items_placement" CHECK(`placement` IN ('home', 'commission')),
	CONSTRAINT "site_hero_items_orientation" CHECK(`orientation` IN ('landscape', 'portrait')),
	CONSTRAINT "site_hero_items_alt_nonempty" CHECK(`alt_text` = trim(`alt_text`) AND length(`alt_text`) BETWEEN 1 AND 500),
	CONSTRAINT "site_hero_items_sort" CHECK(`sort_order` >= 0 AND (`enabled` = 0 OR `sort_order` <= 4)),
	CONSTRAINT "site_hero_items_preview_state" CHECK((`preview_object_key` IS NULL AND `preview_expires_at` IS NULL) OR (`preview_object_key` IS NOT NULL AND `preview_expires_at` IS NOT NULL)),
	CONSTRAINT "site_hero_items_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `site_hero_items_enabled_sort_unique`
ON `site_hero_items` (`placement`, `orientation`, `sort_order`) WHERE `enabled` = 1;--> statement-breakpoint
CREATE INDEX `site_hero_items_collection_idx`
ON `site_hero_items` (`placement`, `orientation`, `enabled`, `sort_order`);--> statement-breakpoint
CREATE INDEX `site_hero_items_asset_idx` ON `site_hero_items` (`asset_id`);--> statement-breakpoint

INSERT INTO `site_hero_items` (
	`id`, `placement`, `orientation`, `asset_id`, `alt_text`, `sort_order`,
	`enabled`, `preview_object_key`, `preview_expires_at`, `version`,
	`created_at`, `updated_at`
)
SELECT
	`id` || ':landscape', `placement`, 'landscape', `landscape_asset_id`,
	`alt_text`,
	row_number() OVER (
		PARTITION BY `placement`
		ORDER BY CASE WHEN `enabled` = 1 THEN 0 ELSE 1 END, `sort_order`, `id`
	) - 1,
	`enabled`, NULL, NULL, `version`, `created_at`, `updated_at`
FROM `site_hero_slides`;--> statement-breakpoint
INSERT INTO `site_hero_items` (
	`id`, `placement`, `orientation`, `asset_id`, `alt_text`, `sort_order`,
	`enabled`, `preview_object_key`, `preview_expires_at`, `version`,
	`created_at`, `updated_at`
)
SELECT
	`id` || ':portrait', `placement`, 'portrait', `portrait_asset_id`,
	`alt_text`,
	row_number() OVER (
		PARTITION BY `placement`
		ORDER BY CASE WHEN `enabled` = 1 THEN 0 ELSE 1 END, `sort_order`, `id`
	) - 1,
	`enabled`, NULL, NULL, `version`, `created_at`, `updated_at`
FROM `site_hero_slides`;--> statement-breakpoint

CREATE TRIGGER `site_hero_items_asset_role_insert`
BEFORE INSERT ON `site_hero_items`
WHEN NOT EXISTS (
	SELECT 1 FROM `assets`
	WHERE `id` = NEW.`asset_id`
		AND `role` = CASE NEW.`orientation`
			WHEN 'landscape' THEN 'home_hero_landscape'
			ELSE 'home_hero_portrait'
		END
)
BEGIN
	SELECT RAISE(ABORT, 'hero item asset role does not match orientation');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_items_asset_role_update`
BEFORE UPDATE OF `asset_id`, `orientation` ON `site_hero_items`
WHEN NOT EXISTS (
	SELECT 1 FROM `assets`
	WHERE `id` = NEW.`asset_id`
		AND `role` = CASE NEW.`orientation`
			WHEN 'landscape' THEN 'home_hero_landscape'
			ELSE 'home_hero_portrait'
		END
)
BEGIN
	SELECT RAISE(ABORT, 'hero item asset role does not match orientation');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_items_enabled_limit_insert`
BEFORE INSERT ON `site_hero_items`
WHEN NEW.`enabled` = 1 AND (
	SELECT count(*) FROM `site_hero_items`
	WHERE `placement` = NEW.`placement`
		AND `orientation` = NEW.`orientation`
		AND `enabled` = 1
) >= 5
BEGIN
	SELECT RAISE(ABORT, 'hero collection cannot enable more than five items');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_items_enabled_limit_update`
BEFORE UPDATE OF `enabled`, `placement`, `orientation` ON `site_hero_items`
WHEN NEW.`enabled` = 1 AND (
	SELECT count(*) FROM `site_hero_items`
	WHERE `placement` = NEW.`placement`
		AND `orientation` = NEW.`orientation`
		AND `enabled` = 1
		AND `id` != OLD.`id`
) >= 5
BEGIN
	SELECT RAISE(ABORT, 'hero collection cannot enable more than five items');
END;--> statement-breakpoint

-- Replace the legacy shared site/home upload owner with a collection-bound owner.
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
	CONSTRAINT "upload_sessions_media_role" CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo')) OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-landscape', 'hero-commission-landscape') AND `media_role` = 'home_hero_landscape') OR (`owner_type` = 'site' AND `owner_id` IN ('hero-home-portrait', 'hero-commission-portrait') AND `media_role` = 'home_hero_portrait') OR (`owner_type` = 'site' AND `owner_id` = 'branding' AND `media_role` = 'watermark_logo') OR (`owner_type` = 'site' AND `owner_id` = 'contact' AND `media_role` = 'contact_qr')),
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
INSERT INTO `__new_upload_sessions` (
	`id`, `owner_type`, `owner_id`, `owner_version`, `media_role`,
	`private_object_key`, `expected_content_type`, `expected_bytes`,
	`expected_content_md5`, `expected_sha256`, `expected_width`,
	`expected_height`, `created_by`, `status`, `asset_id`, `version`,
	`failure_code`, `failure_stage`, `created_at`, `expires_at`, `updated_at`, `cleaned_at`
)
SELECT
	`id`, `owner_type`,
	CASE WHEN `owner_type` = 'site' AND `owner_id` = 'home'
		THEN CASE `media_role`
			WHEN 'home_hero_landscape' THEN 'hero-home-landscape'
			ELSE 'hero-home-portrait'
		END
		ELSE `owner_id`
	END,
	CASE WHEN `owner_type` = 'site' AND `owner_id` = 'home' THEN 1 ELSE `owner_version` END,
	`media_role`, `private_object_key`, `expected_content_type`, `expected_bytes`,
	`expected_content_md5`, `expected_sha256`, `expected_width`, `expected_height`,
	`created_by`, `status`, `asset_id`, `version`, `failure_code`, `failure_stage`,
	`created_at`, `expires_at`, `updated_at`, `cleaned_at`
FROM `upload_sessions`;--> statement-breakpoint
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
			AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
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

PRAGMA foreign_key_check;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
