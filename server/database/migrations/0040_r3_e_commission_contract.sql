PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

CREATE TABLE `__new_site_content` (
	`id` text PRIMARY KEY DEFAULT 'site' NOT NULL,
	`hero_tagline` text,
	`contact_email` text,
	`contact_qq` text,
	`official_channels_json` text DEFAULT '[{"platform":"qq","account":null,"qrCodeAssetId":null},{"platform":"qq_group","account":null,"qrCodeAssetId":null}]' NOT NULL,
	`commission_intro` text,
	`commission_estimate_note` text,
	`commission_email_action` text,
	`about_studio_facts` text,
	`about_making_scope` text,
	`basic_terms` text,
	`privacy_policy` text,
	`contact_anti_scam` text,
	`hero_auto_rotate` integer DEFAULT false NOT NULL,
	`hero_auto_rotate_interval_ms` integer DEFAULT 6000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`commission_content_version` integer DEFAULT 1 NOT NULL,
	`about_content_version` integer DEFAULT 1 NOT NULL,
	`terms_content_version` integer DEFAULT 1 NOT NULL,
	`privacy_content_version` integer DEFAULT 1 NOT NULL,
	`contact_content_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "site_content_singleton" CHECK(`id` = 'site'),
	CONSTRAINT "site_content_section_versions_positive" CHECK(`commission_content_version` > 0 AND `about_content_version` > 0 AND `terms_content_version` > 0 AND `privacy_content_version` > 0 AND `contact_content_version` > 0),
	CONSTRAINT "site_content_tagline" CHECK(`hero_tagline` IS NULL OR length(trim(`hero_tagline`)) BETWEEN 1 AND 120),
	CONSTRAINT "site_content_rotation_interval" CHECK(`hero_auto_rotate_interval_ms` >= 6000),
	CONSTRAINT "site_content_commission_intro" CHECK(`commission_intro` IS NULL OR (length(trim(`commission_intro`)) BETWEEN 1 AND 240 AND `commission_intro` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_official_channels_json" CHECK(json_valid(`official_channels_json`) AND json_type(`official_channels_json`) = 'array' AND json_array_length(`official_channels_json`) = 2 AND json_extract(`official_channels_json`, '$[0].platform') = 'qq' AND json_extract(`official_channels_json`, '$[1].platform') = 'qq_group' AND length(`official_channels_json`) <= 2000),
	CONSTRAINT "site_content_commission_estimate_note" CHECK(`commission_estimate_note` IS NULL OR (length(trim(`commission_estimate_note`)) BETWEEN 1 AND 600 AND `commission_estimate_note` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_commission_email_action" CHECK(`commission_email_action` IS NULL OR (length(trim(`commission_email_action`)) BETWEEN 1 AND 240 AND `commission_email_action` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_about_studio_facts" CHECK(`about_studio_facts` IS NULL OR (length(trim(`about_studio_facts`)) BETWEEN 1 AND 1200 AND `about_studio_facts` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_about_making_scope" CHECK(`about_making_scope` IS NULL OR (length(trim(`about_making_scope`)) BETWEEN 1 AND 1200 AND `about_making_scope` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_basic_terms" CHECK(`basic_terms` IS NULL OR (length(trim(`basic_terms`)) BETWEEN 1 AND 8000 AND `basic_terms` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_privacy_policy" CHECK(`privacy_policy` IS NULL OR (length(trim(`privacy_policy`)) BETWEEN 1 AND 8000 AND `privacy_policy` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_contact_anti_scam" CHECK(`contact_anti_scam` IS NULL OR (length(trim(`contact_anti_scam`)) BETWEEN 1 AND 600 AND `contact_anti_scam` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint

INSERT INTO `__new_site_content` (
	`id`, `hero_tagline`, `contact_email`, `contact_qq`, `official_channels_json`,
	`commission_intro`, `commission_estimate_note`, `commission_email_action`,
	`about_studio_facts`, `about_making_scope`, `basic_terms`, `privacy_policy`,
	`contact_anti_scam`, `hero_auto_rotate`, `hero_auto_rotate_interval_ms`,
	`version`, `commission_content_version`, `about_content_version`,
	`terms_content_version`, `privacy_content_version`, `contact_content_version`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `hero_tagline`, `contact_email`, `contact_qq`, `official_channels_json`,
	`commission_intro`, `commission_estimate_note`, `commission_email_action`,
	`about_studio_facts`, `about_making_scope`, `basic_terms`, `privacy_policy`,
	`contact_anti_scam`, `hero_auto_rotate`, `hero_auto_rotate_interval_ms`,
	`version`, `commission_content_version`, `about_content_version`,
	`terms_content_version`, `privacy_content_version`, `contact_content_version`,
	`created_at`, `updated_at`
FROM `site_content`;--> statement-breakpoint

DROP TABLE `site_content`;--> statement-breakpoint
ALTER TABLE `__new_site_content` RENAME TO `site_content`;--> statement-breakpoint

PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
