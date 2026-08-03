PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_business_statuses` (
	`kind` text PRIMARY KEY NOT NULL,
	`tone` text NOT NULL,
	`label` text NOT NULL,
	`detail` text NOT NULL,
	`href` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "business_statuses_kind" CHECK("__new_business_statuses"."kind" IN ('commission', 'adoption')),
	CONSTRAINT "business_statuses_tone" CHECK("__new_business_statuses"."tone" IN ('open', 'limited', 'closed')),
	CONSTRAINT "business_statuses_text" CHECK(length(trim("__new_business_statuses"."label")) > 0 AND length(trim("__new_business_statuses"."detail")) > 0),
	CONSTRAINT "business_statuses_href" CHECK(("__new_business_statuses"."kind" = 'commission' AND "__new_business_statuses"."href" = '/commission') OR ("__new_business_statuses"."kind" = 'adoption' AND "__new_business_statuses"."href" = '/adoptions')),
	CONSTRAINT "business_statuses_version_positive" CHECK("__new_business_statuses"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_business_statuses`("kind", "tone", "label", "detail", "href", "version", "created_at", "updated_at") SELECT "kind", "tone", "label", "detail", "href", "version", "created_at", "updated_at" FROM `business_statuses`;--> statement-breakpoint
DROP TABLE `business_statuses`;--> statement-breakpoint
ALTER TABLE `__new_business_statuses` RENAME TO `business_statuses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
CREATE TABLE `__new_site_content` (
	`id` text PRIMARY KEY DEFAULT 'site' NOT NULL,
	`hero_tagline` text,
	`contact_email` text,
	`contact_qq` text,
	`contact_douyin` text,
	`commission_intro` text,
	`commission_estimate_note` text,
	`commission_email_action` text,
	`commission_faq_json` text,
	`about_studio_facts` text,
	`about_making_scope` text,
	`basic_terms` text,
	`contact_anti_scam` text,
	`hero_auto_rotate` integer DEFAULT false NOT NULL,
	`hero_auto_rotate_interval_ms` integer DEFAULT 6000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "site_content_singleton" CHECK("__new_site_content"."id" = 'site'),
	CONSTRAINT "site_content_tagline" CHECK("__new_site_content"."hero_tagline" IS NULL OR (length(trim("__new_site_content"."hero_tagline")) BETWEEN 1 AND 120)),
	CONSTRAINT "site_content_rotation_interval" CHECK("__new_site_content"."hero_auto_rotate_interval_ms" >= 6000),
	CONSTRAINT "site_content_commission_intro" CHECK("__new_site_content"."commission_intro" IS NULL OR (length(trim("__new_site_content"."commission_intro")) BETWEEN 1 AND 240 AND "__new_site_content"."commission_intro" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_contact_douyin" CHECK("__new_site_content"."contact_douyin" IS NULL OR ("__new_site_content"."contact_douyin" = trim("__new_site_content"."contact_douyin") AND length("__new_site_content"."contact_douyin") BETWEEN 2 AND 30 AND "__new_site_content"."contact_douyin" NOT GLOB '*[ <>]*')),
	CONSTRAINT "site_content_commission_estimate_note" CHECK("__new_site_content"."commission_estimate_note" IS NULL OR (length(trim("__new_site_content"."commission_estimate_note")) BETWEEN 1 AND 600 AND "__new_site_content"."commission_estimate_note" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_commission_email_action" CHECK("__new_site_content"."commission_email_action" IS NULL OR (length(trim("__new_site_content"."commission_email_action")) BETWEEN 1 AND 240 AND "__new_site_content"."commission_email_action" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_commission_faq_json" CHECK("__new_site_content"."commission_faq_json" IS NULL OR (json_valid("__new_site_content"."commission_faq_json") AND json_type("__new_site_content"."commission_faq_json") = 'array' AND length("__new_site_content"."commission_faq_json") <= 12000)),
	CONSTRAINT "site_content_about_studio_facts" CHECK("__new_site_content"."about_studio_facts" IS NULL OR (length(trim("__new_site_content"."about_studio_facts")) BETWEEN 1 AND 1200 AND "__new_site_content"."about_studio_facts" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_about_making_scope" CHECK("__new_site_content"."about_making_scope" IS NULL OR (length(trim("__new_site_content"."about_making_scope")) BETWEEN 1 AND 1200 AND "__new_site_content"."about_making_scope" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_basic_terms" CHECK("__new_site_content"."basic_terms" IS NULL OR (length(trim("__new_site_content"."basic_terms")) BETWEEN 1 AND 8000 AND "__new_site_content"."basic_terms" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_contact_anti_scam" CHECK("__new_site_content"."contact_anti_scam" IS NULL OR (length(trim("__new_site_content"."contact_anti_scam")) BETWEEN 1 AND 600 AND "__new_site_content"."contact_anti_scam" NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_version_positive" CHECK("__new_site_content"."version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_site_content`("id", "hero_tagline", "contact_email", "contact_qq", "contact_douyin", "commission_intro", "commission_estimate_note", "commission_email_action", "commission_faq_json", "about_studio_facts", "about_making_scope", "basic_terms", "contact_anti_scam", "hero_auto_rotate", "hero_auto_rotate_interval_ms", "version", "created_at", "updated_at") SELECT "id", "hero_tagline", "contact_email", "contact_qq", 'to3114559925', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, "hero_auto_rotate", "hero_auto_rotate_interval_ms", "version", "created_at", "updated_at" FROM `site_content`;--> statement-breakpoint
DROP TABLE `site_content`;--> statement-breakpoint
ALTER TABLE `__new_site_content` RENAME TO `site_content`;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_owner_insert`
BEFORE INSERT ON `upload_sessions`
WHEN
  (
    NEW.`owner_type` = 'work'
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
        AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'home'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (
      SELECT `version` FROM `site_branding` WHERE `id` = 'site'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;
