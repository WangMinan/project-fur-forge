ALTER TABLE `site_content` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `site_content` ADD `contact_qq` text;--> statement-breakpoint
UPDATE `site_content`
SET `contact_email` = '3114559925@qq.com',
    `contact_qq` = '3114559925'
WHERE `id` = 'site';
