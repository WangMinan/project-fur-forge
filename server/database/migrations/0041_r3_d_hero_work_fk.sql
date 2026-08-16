-- R3-D forward repair: rebuilding works in 0039 caused SQLite to retarget the
-- legacy hero link FK to __old_works. Rebuild the compatibility table so its
-- nullable link once again references the contracted works table.
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_preserve_enabled_hero_link`;--> statement-breakpoint
CREATE TABLE `__new_site_hero_slides` (
	`id` text PRIMARY KEY NOT NULL,
	`landscape_asset_id` text NOT NULL,
	`portrait_asset_id` text NOT NULL,
	`alt_text` text NOT NULL,
	`sort_order` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`linked_work_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`landscape_preview_object_key` text,
	`portrait_preview_object_key` text,
	`preview_expires_at` integer,
	`placement` text DEFAULT 'home' NOT NULL CHECK (`placement` IN ('home', 'commission')),
	FOREIGN KEY (`landscape_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portrait_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "site_hero_slides_pair_distinct" CHECK(`landscape_asset_id` != `portrait_asset_id`),
	CONSTRAINT "site_hero_slides_alt_nonempty" CHECK(`alt_text` = trim(`alt_text`) AND length(`alt_text`) BETWEEN 1 AND 500),
	CONSTRAINT "site_hero_slides_sort" CHECK(`sort_order` >= 0 AND (`enabled` = 0 OR `sort_order` <= 4)),
	CONSTRAINT "site_hero_slides_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_site_hero_slides` SELECT * FROM `site_hero_slides`;--> statement-breakpoint
DROP TABLE `site_hero_slides`;--> statement-breakpoint
ALTER TABLE `__new_site_hero_slides` RENAME TO `site_hero_slides`;--> statement-breakpoint
CREATE UNIQUE INDEX `site_hero_slides_enabled_sort_unique`
ON `site_hero_slides` (`placement`, `sort_order`) WHERE `enabled` = 1;--> statement-breakpoint

CREATE TRIGGER `site_hero_slides_ready_insert`
BEFORE INSERT ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets` WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape' AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets` WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait' AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM `works` WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_slides_ready_update`
BEFORE UPDATE OF `landscape_asset_id`, `portrait_asset_id`, `enabled`, `linked_work_id`
ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets` WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape' AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets` WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait' AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM `works` WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
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
CREATE TRIGGER `works_preserve_enabled_hero_link`
BEFORE UPDATE OF `publication_status` ON `works`
WHEN NEW.`publication_status` != 'published' AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1 AND `linked_work_id` = OLD.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'published work is linked by an enabled hero slide');
END;
