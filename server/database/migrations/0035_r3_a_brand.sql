UPDATE `site_content`
SET `hero_tagline` = '不只做小狗毛 | 只做海绵头',
    `version` = `version` + 1,
    `updated_at` = unixepoch() * 1000
WHERE `id` = 'site'
  AND (`hero_tagline` IS NULL OR `hero_tagline` = '不只做小狗毛');
