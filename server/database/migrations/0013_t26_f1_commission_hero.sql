ALTER TABLE `site_hero_slides` ADD `placement` text DEFAULT 'home' NOT NULL CHECK (`placement` IN ('home', 'commission'));--> statement-breakpoint
DROP INDEX `site_hero_slides_enabled_sort_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `site_hero_slides_enabled_sort_unique` ON `site_hero_slides` (`placement`,`sort_order`) WHERE `site_hero_slides`.`enabled` = 1;
