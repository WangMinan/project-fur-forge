INSERT OR IGNORE INTO `site_content` (
  `id`, `hero_tagline`, `hero_auto_rotate`,
  `hero_auto_rotate_interval_ms`, `version`, `created_at`, `updated_at`
) VALUES (
  'site', '不只做小狗毛', 0, 6000, 1,
  unixepoch() * 1000, unixepoch() * 1000
);
--> statement-breakpoint
UPDATE `site_content`
SET `hero_tagline` = '不只做小狗毛',
    `version` = `version` + 1,
    `updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND `hero_tagline` IS NULL;
