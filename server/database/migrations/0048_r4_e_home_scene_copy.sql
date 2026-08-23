-- R4-E: 首页 2-4 幕文字块导语成为管理端可编辑字段。
-- 章节标题、英文 eyebrow 与按钮文字仍是业务语义/视觉元素，继续写死在组件中。
-- 内联列级 CHECK 与 0015_t27_f1_privacy_policy.sql 同一写法，无需重建表。
ALTER TABLE `site_content` ADD COLUMN `home_featured_lead` text
  CONSTRAINT "site_content_home_featured_lead" CHECK(
    `home_featured_lead` IS NULL OR (
      length(trim(`home_featured_lead`)) BETWEEN 1 AND 120
      AND `home_featured_lead` NOT GLOB '*[<>]*'
    )
  );
--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `home_commission_lead` text
  CONSTRAINT "site_content_home_commission_lead" CHECK(
    `home_commission_lead` IS NULL OR (
      length(trim(`home_commission_lead`)) BETWEEN 1 AND 120
      AND `home_commission_lead` NOT GLOB '*[<>]*'
    )
  );
--> statement-breakpoint
ALTER TABLE `site_content` ADD COLUMN `home_adoption_lead` text
  CONSTRAINT "site_content_home_adoption_lead" CHECK(
    `home_adoption_lead` IS NULL OR (
      length(trim(`home_adoption_lead`)) BETWEEN 1 AND 120
      AND `home_adoption_lead` NOT GLOB '*[<>]*'
    )
  );
--> statement-breakpoint
-- 版本列与其它分区一致从 1 起。既有表级 site_content_section_versions_positive
-- 无法被 ALTER TABLE 修改，因此本列自带同义的列级 CHECK。
ALTER TABLE `site_content` ADD COLUMN `home_copy_version` integer DEFAULT 1 NOT NULL
  CONSTRAINT "site_content_home_copy_version_positive" CHECK(`home_copy_version` > 0);
--> statement-breakpoint
UPDATE `site_content`
SET
  `home_featured_lead` = '这里挑了几件我们自己也很喜欢的作品。如果你想看更多的小狗毛，请访问作品展示。',
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND `home_featured_lead` IS NULL;
--> statement-breakpoint
UPDATE `site_content`
SET
  `home_commission_lead` = '欢迎带着你的设定图来估价，请看看对应的流程。我们会负责把你的想法变成现实。',
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND `home_commission_lead` IS NULL;
--> statement-breakpoint
UPDATE `site_content`
SET
  `home_adoption_lead` = '设定领养包含了我们已经部分完成的作品，你也许可以在这里找到自己想成为的角色。',
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND `home_adoption_lead` IS NULL;
