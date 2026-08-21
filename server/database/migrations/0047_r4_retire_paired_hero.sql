DROP TRIGGER IF EXISTS `works_preserve_enabled_hero_link`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
DROP TABLE IF EXISTS `site_hero_slides`;--> statement-breakpoint

CREATE TRIGGER `assets_preserve_enabled_hero`
BEFORE UPDATE OF `status`, `role` ON `assets`
WHEN (NEW.`status` != 'READY' OR NEW.`role` != OLD.`role`) AND EXISTS (
  SELECT 1 FROM `site_hero_items`
  WHERE `enabled` = 1 AND `asset_id` = OLD.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero item requires a READY asset');
END;
