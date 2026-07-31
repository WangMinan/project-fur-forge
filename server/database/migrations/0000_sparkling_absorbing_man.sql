CREATE TABLE `asset_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`storage_scope` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`object_key` text NOT NULL,
	`input_sha256` text NOT NULL,
	`media_role` text NOT NULL,
	`usage` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text NOT NULL,
	`quality` integer NOT NULL,
	`crop_identity` text NOT NULL,
	`recipe_version` text NOT NULL,
	`watermark_profile` text NOT NULL,
	`logo_digest` text NOT NULL,
	`watermark_anchor` text NOT NULL,
	`sha256` text,
	`byte_size` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "asset_variants_storage_scope" CHECK("asset_variants"."storage_scope" IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "asset_variants_status" CHECK("asset_variants"."status" IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "asset_variants_key_relative" CHECK(length(trim("asset_variants"."object_key")) > 0 AND instr("asset_variants"."object_key", '://') = 0 AND substr("asset_variants"."object_key", 1, 1) != '/'),
	CONSTRAINT "asset_variants_input_sha256" CHECK(length("asset_variants"."input_sha256") = 64 AND "asset_variants"."input_sha256" = lower("asset_variants"."input_sha256") AND "asset_variants"."input_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "asset_variants_media_role" CHECK("asset_variants"."media_role" IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')),
	CONSTRAINT "asset_variants_usage" CHECK("asset_variants"."usage" IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait')),
	CONSTRAINT "asset_variants_dimensions" CHECK("asset_variants"."width" BETWEEN 1 AND 12000 AND "asset_variants"."height" BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK("asset_variants"."format" IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK("asset_variants"."quality" BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim("asset_variants"."crop_identity")) > 0 AND length(trim("asset_variants"."recipe_version")) > 0 AND length(trim("asset_variants"."watermark_profile")) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK("asset_variants"."logo_digest" = 'none' OR (length("asset_variants"."logo_digest") = 64 AND "asset_variants"."logo_digest" = lower("asset_variants"."logo_digest") AND "asset_variants"."logo_digest" NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK("asset_variants"."watermark_anchor" IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right')),
	CONSTRAINT "asset_variants_public_watermark" CHECK("asset_variants"."storage_scope" != 'PUBLIC' OR ("asset_variants"."watermark_profile" = 'brand-standard-v1' AND "asset_variants"."logo_digest" != 'none' AND "asset_variants"."watermark_anchor" != 'none')),
	CONSTRAINT "asset_variants_preprocess_private" CHECK("asset_variants"."usage" != 'preprocess' OR ("asset_variants"."storage_scope" = 'PRIVATE' AND "asset_variants"."watermark_profile" = 'none' AND "asset_variants"."logo_digest" = 'none' AND "asset_variants"."watermark_anchor" = 'none')),
	CONSTRAINT "asset_variants_ready_output" CHECK("asset_variants"."status" != 'READY' OR ("asset_variants"."sha256" IS NOT NULL AND length("asset_variants"."sha256") = 64 AND "asset_variants"."byte_size" > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK("asset_variants"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`);--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`private_object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "assets_role" CHECK("assets"."role" IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait')),
	CONSTRAINT "assets_status" CHECK("assets"."status" IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "assets_private_key_relative" CHECK(length(trim("assets"."private_object_key")) > 0 AND instr("assets"."private_object_key", '://') = 0 AND substr("assets"."private_object_key", 1, 1) != '/'),
	CONSTRAINT "assets_sha256" CHECK(length("assets"."sha256") = 64 AND "assets"."sha256" = lower("assets"."sha256") AND "assets"."sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "assets_byte_size" CHECK("assets"."byte_size" BETWEEN 1 AND 30000000),
	CONSTRAINT "assets_dimensions" CHECK("assets"."width" BETWEEN 1 AND 12000 AND "assets"."height" BETWEEN 1 AND 12000),
	CONSTRAINT "assets_hero_orientation" CHECK(("assets"."role" != 'home_hero_landscape' OR "assets"."width" > "assets"."height") AND ("assets"."role" != 'home_hero_portrait' OR "assets"."height" > "assets"."width")),
	CONSTRAINT "assets_mime_type" CHECK("assets"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_version_positive" CHECK("assets"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_logs_action_nonempty" CHECK(length(trim("audit_logs"."action")) > 0),
	CONSTRAINT "audit_logs_entity_type_nonempty" CHECK(length(trim("audit_logs"."entity_type")) > 0),
	CONSTRAINT "audit_logs_result" CHECK("audit_logs"."result" IN ('SUCCESS', 'FAILURE'))
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `business_statuses` (
	`kind` text PRIMARY KEY NOT NULL,
	`tone` text NOT NULL,
	`label` text NOT NULL,
	`detail` text NOT NULL,
	`href` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "business_statuses_kind" CHECK("business_statuses"."kind" IN ('commission', 'adoption')),
	CONSTRAINT "business_statuses_tone" CHECK("business_statuses"."tone" IN ('open', 'limited', 'closed')),
	CONSTRAINT "business_statuses_text" CHECK(length(trim("business_statuses"."label")) > 0 AND length(trim("business_statuses"."detail")) > 0),
	CONSTRAINT "business_statuses_href" CHECK("business_statuses"."href" IN ('/commission', '/adoptions'))
);
--> statement-breakpoint
CREATE TABLE `publication_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`requested_version` integer NOT NULL,
	`status` text NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`internal_error_code` text,
	`internal_error_message` text,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "publication_operations_entity_type" CHECK("publication_operations"."entity_type" IN ('WORK', 'HOME')),
	CONSTRAINT "publication_operations_status" CHECK("publication_operations"."status" IN ('GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "publication_operations_requested_version" CHECK("publication_operations"."requested_version" > 0)
);
--> statement-breakpoint
CREATE INDEX `publication_operations_entity_idx` ON `publication_operations` (`entity_type`,`entity_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `site_content` (
	`id` text PRIMARY KEY DEFAULT 'site' NOT NULL,
	`hero_tagline` text,
	`hero_auto_rotate` integer DEFAULT false NOT NULL,
	`hero_auto_rotate_interval_ms` integer DEFAULT 6000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "site_content_singleton" CHECK("site_content"."id" = 'site'),
	CONSTRAINT "site_content_tagline" CHECK("site_content"."hero_tagline" IS NULL OR (length(trim("site_content"."hero_tagline")) BETWEEN 1 AND 120)),
	CONSTRAINT "site_content_rotation_interval" CHECK("site_content"."hero_auto_rotate_interval_ms" >= 6000),
	CONSTRAINT "site_content_version_positive" CHECK("site_content"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE `site_hero_slides` (
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
	FOREIGN KEY (`landscape_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portrait_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "site_hero_slides_pair_distinct" CHECK("site_hero_slides"."landscape_asset_id" != "site_hero_slides"."portrait_asset_id"),
	CONSTRAINT "site_hero_slides_alt_nonempty" CHECK("site_hero_slides"."alt_text" = trim("site_hero_slides"."alt_text") AND length("site_hero_slides"."alt_text") BETWEEN 1 AND 500),
	CONSTRAINT "site_hero_slides_sort" CHECK("site_hero_slides"."sort_order" >= 0 AND ("site_hero_slides"."enabled" = 0 OR "site_hero_slides"."sort_order" <= 4)),
	CONSTRAINT "site_hero_slides_version_positive" CHECK("site_hero_slides"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_hero_slides_enabled_sort_unique` ON `site_hero_slides` (`sort_order`) WHERE "site_hero_slides"."enabled" = 1;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`password_changed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_username_nonempty" CHECK("users"."username" = trim("users"."username") AND length("users"."username") BETWEEN 1 AND 100),
	CONSTRAINT "users_password_hash_nonempty" CHECK(length("users"."password_hash") > 0),
	CONSTRAINT "users_session_version_positive" CHECK("users"."session_version" > 0),
	CONSTRAINT "users_failed_login_count_nonnegative" CHECK("users"."failed_login_count" >= 0),
	CONSTRAINT "users_version_positive" CHECK("users"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `work_assets` (
	`work_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`crop_x` real DEFAULT 0 NOT NULL,
	`crop_y` real DEFAULT 0 NOT NULL,
	`crop_width` real DEFAULT 1 NOT NULL,
	`crop_height` real DEFAULT 1 NOT NULL,
	`watermark_anchor` text DEFAULT 'top-left' NOT NULL,
	PRIMARY KEY(`work_id`, `asset_id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "work_assets_role" CHECK("work_assets"."role" IN ('design_sheet', 'studio_photo')),
	CONSTRAINT "work_assets_position" CHECK(("work_assets"."role" = 'design_sheet' AND "work_assets"."position" = 0) OR ("work_assets"."role" = 'studio_photo' AND "work_assets"."position" BETWEEN 0 AND 4)),
	CONSTRAINT "work_assets_focus" CHECK("work_assets"."focal_x" BETWEEN 0 AND 1 AND "work_assets"."focal_y" BETWEEN 0 AND 1),
	CONSTRAINT "work_assets_crop" CHECK("work_assets"."crop_x" BETWEEN 0 AND 1 AND "work_assets"."crop_y" BETWEEN 0 AND 1 AND "work_assets"."crop_width" > 0 AND "work_assets"."crop_width" <= 1 AND "work_assets"."crop_height" > 0 AND "work_assets"."crop_height" <= 1 AND "work_assets"."crop_x" + "work_assets"."crop_width" <= 1 AND "work_assets"."crop_y" + "work_assets"."crop_height" <= 1),
	CONSTRAINT "work_assets_watermark_anchor" CHECK("work_assets"."watermark_anchor" IN ('top-left', 'top-right', 'bottom-left', 'bottom-right'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_asset_unique` ON `work_assets` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_position_unique` ON `work_assets` (`work_id`,`role`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_assets_primary_unique` ON `work_assets` (`work_id`,`role`) WHERE "work_assets"."is_primary" = 1;--> statement-breakpoint
CREATE TABLE `work_feature_tags` (
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`work_id`, `position`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_feature_tags_position" CHECK("work_feature_tags"."position" BETWEEN 0 AND 7),
	CONSTRAINT "work_feature_tags_value" CHECK("work_feature_tags"."value" = trim("work_feature_tags"."value") AND length("work_feature_tags"."value") BETWEEN 1 AND 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_feature_tags_value_unique` ON `work_feature_tags` (`work_id`,`value`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`character_name` text NOT NULL,
	`species` text NOT NULL,
	`suit_type` text NOT NULL,
	`purpose` text NOT NULL,
	`adoption_method` text,
	`business_status` text,
	`current_event_name` text,
	`owner_display` text NOT NULL,
	`owner_contact` text,
	`price_amount_minor` integer,
	`price_currency` text,
	`publication_status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "works_slug_nonempty" CHECK("works"."slug" = trim("works"."slug") AND length("works"."slug") BETWEEN 1 AND 120),
	CONSTRAINT "works_character_name_nonempty" CHECK("works"."character_name" = trim("works"."character_name") AND length("works"."character_name") BETWEEN 1 AND 100),
	CONSTRAINT "works_species_nonempty" CHECK("works"."species" = trim("works"."species") AND length("works"."species") BETWEEN 1 AND 100),
	CONSTRAINT "works_suit_type" CHECK("works"."suit_type" IN ('full', 'partial')),
	CONSTRAINT "works_purpose" CHECK("works"."purpose" IN ('commission', 'adoption', 'showcase')),
	CONSTRAINT "works_adoption_method" CHECK("works"."adoption_method" IS NULL OR "works"."adoption_method" IN ('regular', 'event_drop')),
	CONSTRAINT "works_adoption_fields" CHECK(("works"."purpose" = 'adoption') OR ("works"."adoption_method" IS NULL AND "works"."business_status" IS NULL AND "works"."current_event_name" IS NULL AND "works"."price_amount_minor" IS NULL AND "works"."price_currency" IS NULL)),
	CONSTRAINT "works_business_status" CHECK("works"."business_status" IS NULL OR "works"."business_status" IN ('preparing', 'available', 'event_sale', 'scheduled', 'in_production', 'delivered')),
	CONSTRAINT "works_event_sale" CHECK("works"."business_status" != 'event_sale' OR ("works"."adoption_method" = 'event_drop' AND length(trim("works"."current_event_name")) > 0)),
	CONSTRAINT "works_owner_display_nonempty" CHECK("works"."owner_display" = trim("works"."owner_display") AND length("works"."owner_display") BETWEEN 1 AND 100),
	CONSTRAINT "works_price_cny" CHECK(("works"."price_amount_minor" IS NULL AND "works"."price_currency" IS NULL) OR ("works"."purpose" = 'adoption' AND "works"."price_amount_minor" > 0 AND "works"."price_currency" = 'CNY')),
	CONSTRAINT "works_publication_status" CHECK("works"."publication_status" IN ('draft', 'published', 'unpublished')),
	CONSTRAINT "works_sort_order_nonnegative" CHECK("works"."sort_order" >= 0),
	CONSTRAINT "works_version_positive" CHECK("works"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_slug_unique` ON `works` (`slug`);--> statement-breakpoint
CREATE INDEX `works_publication_sort_idx` ON `works` (`publication_status`,`sort_order`);--> statement-breakpoint
CREATE TRIGGER `users_single_admin_insert`
BEFORE INSERT ON `users`
WHEN (SELECT count(*) FROM `users`) >= 1
BEGIN
  SELECT RAISE(ABORT, 'only one administrator is allowed');
END;--> statement-breakpoint
CREATE TRIGGER `assets_original_identity_immutable`
BEFORE UPDATE OF `role`, `private_object_key`, `sha256`, `byte_size`, `mime_type`, `width`, `height`
ON `assets`
WHEN
  NEW.`role` != OLD.`role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`sha256` != OLD.`sha256`
  OR NEW.`byte_size` != OLD.`byte_size`
  OR NEW.`mime_type` != OLD.`mime_type`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
BEGIN
  SELECT RAISE(ABORT, 'original asset identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF
  `asset_id`, `storage_scope`, `object_key`, `input_sha256`, `media_role`,
  `usage`, `width`, `height`, `format`, `quality`, `crop_identity`,
  `recipe_version`, `watermark_profile`, `logo_digest`, `watermark_anchor`
ON `asset_variants`
WHEN
  NEW.`asset_id` != OLD.`asset_id`
  OR NEW.`storage_scope` != OLD.`storage_scope`
  OR NEW.`object_key` != OLD.`object_key`
  OR NEW.`input_sha256` != OLD.`input_sha256`
  OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`usage` != OLD.`usage`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`format` != OLD.`format`
  OR NEW.`quality` != OLD.`quality`
  OR NEW.`crop_identity` != OLD.`crop_identity`
  OR NEW.`recipe_version` != OLD.`recipe_version`
  OR NEW.`watermark_profile` != OLD.`watermark_profile`
  OR NEW.`logo_digest` != OLD.`logo_digest`
  OR NEW.`watermark_anchor` != OLD.`watermark_anchor`
BEGIN
  SELECT RAISE(ABORT, 'asset variant identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`media_role` != (
  SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`
)
BEGIN
  SELECT RAISE(ABORT, 'variant role must match original asset role');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_insert`
BEFORE INSERT ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (
    NEW.`role` = 'design_sheet'
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption'
  )
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_role_update`
BEFORE UPDATE OF `work_id`, `asset_id`, `role` ON `work_assets`
WHEN
  NEW.`role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR (
    NEW.`role` = 'design_sheet'
    AND (SELECT `purpose` FROM `works` WHERE `id` = NEW.`work_id`) != 'adoption'
  )
BEGIN
  SELECT RAISE(ABORT, 'work asset role is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_slides_ready_insert`
BEFORE INSERT ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape'
      AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait'
      AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
END;--> statement-breakpoint
CREATE TRIGGER `site_hero_slides_ready_update`
BEFORE UPDATE OF
  `landscape_asset_id`, `portrait_asset_id`, `enabled`, `linked_work_id`
ON `site_hero_slides`
WHEN NEW.`enabled` = 1 AND (
  NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`landscape_asset_id`
      AND `role` = 'home_hero_landscape'
      AND `status` = 'READY'
  )
  OR NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`portrait_asset_id`
      AND `role` = 'home_hero_portrait'
      AND `status` = 'READY'
  )
  OR (
    NEW.`linked_work_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`linked_work_id`
        AND `publication_status` = 'published'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide is not publication-ready');
END;--> statement-breakpoint
CREATE TRIGGER `assets_preserve_enabled_hero`
BEFORE UPDATE OF `status`, `role` ON `assets`
WHEN (
  NEW.`status` != 'READY'
  OR NEW.`role` != OLD.`role`
) AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1
    AND (
      `landscape_asset_id` = OLD.`id`
      OR `portrait_asset_id` = OLD.`id`
    )
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide requires READY assets');
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
