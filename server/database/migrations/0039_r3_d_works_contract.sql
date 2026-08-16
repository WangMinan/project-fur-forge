-- R3-D/T29: contract the works model only after the explicit data gates pass.
-- This migration never guesses an adoption status or synthesizes missing media.
CREATE TEMP TABLE `__r3_d_contract_gate` (
  `gate` text NOT NULL,
  `violation_count` integer NOT NULL
);--> statement-breakpoint
CREATE TEMP TRIGGER `__r3_d_gate_adoption_status`
BEFORE INSERT ON `__r3_d_contract_gate`
WHEN NEW.`gate` = 'adoption_status' AND NEW.`violation_count` != 0
BEGIN
  SELECT RAISE(ABORT, 'R3_D_CONTRACT_BLOCKED_ADOPTION_STATUS');
END;--> statement-breakpoint
CREATE TEMP TRIGGER `__r3_d_gate_adoption_cover`
BEFORE INSERT ON `__r3_d_contract_gate`
WHEN NEW.`gate` = 'adoption_cover' AND NEW.`violation_count` != 0
BEGIN
  SELECT RAISE(ABORT, 'R3_D_CONTRACT_BLOCKED_ADOPTION_COVER');
END;--> statement-breakpoint
CREATE TEMP TRIGGER `__r3_d_gate_primary_studio`
BEFORE INSERT ON `__r3_d_contract_gate`
WHEN NEW.`gate` = 'primary_studio' AND NEW.`violation_count` != 0
BEGIN
  SELECT RAISE(ABORT, 'R3_D_CONTRACT_BLOCKED_PRIMARY_STUDIO_PHOTO');
END;--> statement-breakpoint

-- Stop point 1: Jingchen must explicitly resolve every ambiguous adoption status.
INSERT INTO `__r3_d_contract_gate`
SELECT 'adoption_status', count(*)
FROM `works`
WHERE `purpose` = 'adoption' AND `adoption_status` IS NULL;--> statement-breakpoint

-- Stop point 2: every published adoption needs exactly one READY, described cover.
INSERT INTO `__r3_d_contract_gate`
SELECT 'adoption_cover', count(*)
FROM `works` AS `work`
WHERE `work`.`purpose` = 'adoption'
  AND `work`.`publication_status` = 'published'
  AND 1 != (
    SELECT count(*)
    FROM `work_assets` AS `relation`
    JOIN `assets` AS `asset` ON `asset`.`id` = `relation`.`asset_id`
    WHERE `relation`.`work_id` = `work`.`id`
      AND `relation`.`role` = 'adoption_cover'
      AND `asset`.`role` = 'adoption_cover'
      AND `asset`.`status` = 'READY'
      AND length(trim(COALESCE(`relation`.`alt_text`, ''))) > 0
  );--> statement-breakpoint

-- Stop point 3: every published work needs exactly one READY, described primary photo.
INSERT INTO `__r3_d_contract_gate`
SELECT 'primary_studio', count(*)
FROM `works` AS `work`
WHERE `work`.`publication_status` = 'published'
  AND 1 != (
    SELECT count(*)
    FROM `work_assets` AS `relation`
    JOIN `assets` AS `asset` ON `asset`.`id` = `relation`.`asset_id`
    WHERE `relation`.`work_id` = `work`.`id`
      AND `relation`.`role` = 'studio_photo'
      AND `relation`.`is_primary` = 1
      AND `asset`.`role` = 'studio_photo'
      AND `asset`.`status` = 'READY'
      AND length(trim(COALESCE(`relation`.`alt_text`, ''))) > 0
  );--> statement-breakpoint

DROP TABLE `__r3_d_contract_gate`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

DROP TRIGGER IF EXISTS `works_preserve_enabled_hero_link`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_preserve_design_sheet_purpose`;--> statement-breakpoint
DROP INDEX IF EXISTS `works_slug_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `works_publication_sort_idx`;--> statement-breakpoint
ALTER TABLE `works` RENAME TO `__old_works`;--> statement-breakpoint

CREATE TABLE `works` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `character_name` text NOT NULL,
  `species` text NOT NULL,
  `purpose` text NOT NULL,
  `adoption_status` text,
  `price_amount_minor` integer,
  `price_currency` text,
  `publication_status` text DEFAULT 'draft' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `featured` integer DEFAULT false NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `works_slug_nonempty` CHECK(`slug` = trim(`slug`) AND length(`slug`) BETWEEN 1 AND 120),
  CONSTRAINT `works_character_name_nonempty` CHECK(`character_name` = trim(`character_name`) AND length(`character_name`) BETWEEN 1 AND 100),
  CONSTRAINT `works_species_nonempty` CHECK(`species` = trim(`species`) AND length(`species`) BETWEEN 1 AND 100),
  CONSTRAINT `works_purpose` CHECK(`purpose` IN ('commission', 'adoption', 'showcase')),
  CONSTRAINT `works_adoption_fields` CHECK((`purpose` = 'adoption' AND `adoption_status` IS NOT NULL AND `adoption_status` IN ('available', 'adopted')) OR (`purpose` != 'adoption' AND `adoption_status` IS NULL AND `price_amount_minor` IS NULL AND `price_currency` IS NULL)),
  CONSTRAINT `works_adoption_status` CHECK(`adoption_status` IS NULL OR `adoption_status` IN ('available', 'adopted')),
  CONSTRAINT `works_price_cny` CHECK((`price_amount_minor` IS NULL AND `price_currency` IS NULL) OR (`purpose` = 'adoption' AND `price_amount_minor` > 0 AND `price_currency` = 'CNY')),
  CONSTRAINT `works_publication_status` CHECK(`publication_status` IN ('draft', 'published', 'unpublished')),
  CONSTRAINT `works_sort_order_nonnegative` CHECK(`sort_order` >= 0),
  CONSTRAINT `works_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `works` (
  `id`, `slug`, `character_name`, `species`, `purpose`, `adoption_status`,
  `price_amount_minor`, `price_currency`, `publication_status`, `sort_order`,
  `featured`, `version`, `published_at`, `created_at`, `updated_at`
)
SELECT
  `id`, `slug`, `character_name`, `species`, `purpose`, `adoption_status`,
  `price_amount_minor`, `price_currency`, `publication_status`, `sort_order`,
  `featured`, `version`, `published_at`, `created_at`, `updated_at`
FROM `__old_works`;--> statement-breakpoint
CREATE UNIQUE INDEX `works_slug_unique` ON `works` (`slug`);--> statement-breakpoint
CREATE INDEX `works_publication_sort_idx` ON `works` (`publication_status`, `sort_order`);--> statement-breakpoint

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
  FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON DELETE cascade,
  FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`),
  CONSTRAINT `work_assets_role` CHECK(`role` IN ('design_sheet', 'studio_photo', 'adoption_cover')),
  CONSTRAINT `work_assets_alt_text` CHECK(`alt_text` IS NULL OR (`alt_text` = trim(`alt_text`) AND length(`alt_text`) BETWEEN 1 AND 500)),
  CONSTRAINT `work_assets_position` CHECK((`role` IN ('design_sheet', 'adoption_cover') AND `position` = 0) OR (`role` = 'studio_photo' AND `position` BETWEEN 0 AND 4)),
  CONSTRAINT `work_assets_primary` CHECK(`role` = 'studio_photo' OR `is_primary` = 0),
  CONSTRAINT `work_assets_focus` CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
  CONSTRAINT `work_assets_crop` CHECK(`crop_x` BETWEEN 0 AND 1 AND `crop_y` BETWEEN 0 AND 1 AND `crop_width` > 0 AND `crop_width` <= 1 AND `crop_height` > 0 AND `crop_height` <= 1 AND `crop_x` + `crop_width` <= 1 AND `crop_y` + `crop_height` <= 1),
  CONSTRAINT `work_assets_watermark_anchor` CHECK(`watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right'))
);--> statement-breakpoint
INSERT INTO `__new_work_assets`
SELECT * FROM `work_assets`;--> statement-breakpoint
DROP TABLE `work_assets`;--> statement-breakpoint
ALTER TABLE `__new_work_assets` RENAME TO `work_assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_asset_unique` ON `work_assets` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_position_unique` ON `work_assets` (`work_id`, `role`, `position`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_primary_unique` ON `work_assets` (`work_id`, `role`) WHERE `is_primary` = 1;--> statement-breakpoint

DROP TABLE `work_feature_tags`;--> statement-breakpoint
DROP TABLE `__old_works`;--> statement-breakpoint

CREATE TRIGGER `works_preserve_enabled_hero_link`
BEFORE UPDATE OF `publication_status` ON `works`
WHEN NEW.`publication_status` != 'published' AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1 AND `linked_work_id` = OLD.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'published work is linked by an enabled hero slide');
END;--> statement-breakpoint
CREATE TRIGGER `works_preserve_adoption_media_purpose`
BEFORE UPDATE OF `purpose` ON `works`
WHEN NEW.`purpose` != 'adoption' AND EXISTS (
  SELECT 1 FROM `work_assets`
  WHERE `work_id` = OLD.`id` AND `role` IN ('design_sheet', 'adoption_cover')
)
BEGIN
  SELECT RAISE(ABORT, 'adoption media requires an adoption work');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_insert`
BEFORE INSERT ON `work_assets`
WHEN NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover') AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_update`
BEFORE UPDATE OF `work_id`, `asset_id`, `role` ON `work_assets`
WHEN NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (NEW.`role` IN ('design_sheet', 'adoption_cover') AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption')
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
WHEN NEW.`alt_text` IS NOT NULL AND (NEW.`alt_text` != trim(NEW.`alt_text`) OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500)
BEGIN
  SELECT RAISE(ABORT, 'work asset alt text is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_update`
BEFORE UPDATE OF `alt_text` ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (NEW.`alt_text` != trim(NEW.`alt_text`) OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500)
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

DROP TRIGGER IF EXISTS `asset_variants_role_usage_insert`;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  NEW.`media_role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR NOT (
    (NEW.`media_role` = 'studio_photo' AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
    OR (NEW.`media_role` = 'design_sheet' AND NEW.`usage` IN ('preprocess', 'design-sheet'))
    OR (NEW.`media_role` = 'adoption_cover' AND NEW.`usage` IN ('preprocess', 'adoption-card', 'home-entry-adoption'))
    OR (NEW.`media_role` = 'commission_design_reference' AND NEW.`usage` = 'preprocess')
    OR (NEW.`media_role` = 'home_hero_landscape' AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait' AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'contact_qr' AND NEW.`usage` IN ('preprocess', 'contact-qr'))
  )
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;--> statement-breakpoint

PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
