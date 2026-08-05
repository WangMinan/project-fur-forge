ALTER TABLE `site_content` ADD `commission_content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_content` ADD `commission_faq_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_content` ADD `about_content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_content` ADD `terms_content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_content` ADD `privacy_content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `site_content` ADD `contact_content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `site_content`
SET `commission_faq_json` = (
  SELECT json_group_array(
    json_object(
      'id',
      lower(hex(randomblob(4))) || '-'
        || lower(hex(randomblob(2))) || '-4'
        || substr(lower(hex(randomblob(2))), 2) || '-'
        || substr('89ab', abs(random()) % 4 + 1, 1)
        || substr(lower(hex(randomblob(2))), 2) || '-'
        || lower(hex(randomblob(6))),
      'question', json_extract(`entry`.`value`, '$.question'),
      'answer', json_extract(`entry`.`value`, '$.answer')
    )
  )
  FROM json_each(`site_content`.`commission_faq_json`) AS `entry`
)
WHERE `id` = 'site'
  AND `commission_faq_json` IS NOT NULL
  AND json_valid(`commission_faq_json`)
  AND json_type(`commission_faq_json`) = 'array'
  AND EXISTS (
    SELECT 1 FROM json_each(`site_content`.`commission_faq_json`) AS `probe`
    WHERE json_extract(`probe`.`value`, '$.id') IS NULL
  );
