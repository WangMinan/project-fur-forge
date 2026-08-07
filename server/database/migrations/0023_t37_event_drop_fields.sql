-- T37 轻量展会掉落：把历史 `current_event_name` 规范为 `event_name`，
-- 新增展会时间展示文本 `event_time`，并让两项成组受 CHECK 约束。
--
-- 只新增前向迁移；历史迁移未修改。SQLite 无法直接改列名与 CHECK，
-- 因此 works 采用与迁移 0017/0022 相同的重建流程。
-- 已有 event_drop 记录的展会名称原样保留；event_time 迁移后为 NULL，
-- 由管理员在发布前补齐（发布检查会明确列出缺失项）。
--
-- 因此 CHECK 对 event_drop 草稿容忍缺项，只对已发布的掉落强制两项非空。
-- 已发布的 event_drop 在迁移前不可能存在：T18 起 EVENT_DROP_NOT_READY
-- 一直硬阻断掉落发布，所以这里不需要为它编造占位文案。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- 引用 works 的触发器必须先删除：SQLite 在 ALTER TABLE RENAME 时
-- 重新解析整个 schema，仍引用已被 DROP 的 works 的触发器会让改名失败。
-- work_assets_role_immutable 不引用 works，但与 work_assets_role_update
-- 监听同一个 UPDATE OF role，必须一起重建才能保持既有报错顺序。
DROP TRIGGER IF EXISTS `works_preserve_enabled_hero_link`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `works_preserve_design_sheet_purpose`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `site_hero_slides_ready_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `work_assets_role_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_published_work_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_published_work_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
CREATE TABLE `__new_works` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`character_name` text NOT NULL,
	`species` text NOT NULL,
	`suit_type` text NOT NULL,
	`purpose` text NOT NULL,
	`adoption_method` text,
	`business_status` text,
	`event_name` text,
	`event_time` text,
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
	CONSTRAINT "works_slug_nonempty" CHECK(`slug` = trim(`slug`) AND length(`slug`) BETWEEN 1 AND 120),
	CONSTRAINT "works_character_name_nonempty" CHECK(`character_name` = trim(`character_name`) AND length(`character_name`) BETWEEN 1 AND 100),
	CONSTRAINT "works_species_nonempty" CHECK(`species` = trim(`species`) AND length(`species`) BETWEEN 1 AND 100),
	CONSTRAINT "works_suit_type" CHECK(`suit_type` IN ('full', 'partial')),
	CONSTRAINT "works_purpose" CHECK(`purpose` IN ('commission', 'adoption', 'showcase')),
	CONSTRAINT "works_adoption_method" CHECK(`adoption_method` IS NULL OR `adoption_method` IN ('regular', 'event_drop')),
	CONSTRAINT "works_adoption_fields" CHECK((`purpose` = 'adoption') OR (`adoption_method` IS NULL AND `business_status` IS NULL AND `event_name` IS NULL AND `event_time` IS NULL AND `price_amount_minor` IS NULL AND `price_currency` IS NULL)),
	CONSTRAINT "works_event_drop_fields" CHECK(CASE WHEN `purpose` = 'adoption' AND `adoption_method` = 'event_drop' THEN (`event_name` IS NULL OR length(trim(`event_name`)) BETWEEN 1 AND 80) AND (`event_time` IS NULL OR length(trim(`event_time`)) BETWEEN 1 AND 80) AND (`publication_status` != 'published' OR (`event_name` IS NOT NULL AND `event_time` IS NOT NULL)) ELSE `event_name` IS NULL AND `event_time` IS NULL END),
	CONSTRAINT "works_business_status" CHECK(`business_status` IS NULL OR `business_status` IN ('preparing', 'available', 'event_sale', 'scheduled', 'in_production', 'delivered')),
	CONSTRAINT "works_event_sale" CHECK(`business_status` != 'event_sale' OR (`adoption_method` = 'event_drop' AND length(trim(`event_name`)) > 0)),
	CONSTRAINT "works_owner_display_nonempty" CHECK(`owner_display` = trim(`owner_display`) AND length(`owner_display`) BETWEEN 1 AND 100),
	CONSTRAINT "works_price_cny" CHECK((`price_amount_minor` IS NULL AND `price_currency` IS NULL) OR (`purpose` = 'adoption' AND `price_amount_minor` > 0 AND `price_currency` = 'CNY')),
	CONSTRAINT "works_publication_status" CHECK(`publication_status` IN ('draft', 'published', 'unpublished')),
	CONSTRAINT "works_sort_order_nonnegative" CHECK(`sort_order` >= 0),
	CONSTRAINT "works_version_positive" CHECK(`version` > 0)
);
--> statement-breakpoint
INSERT INTO `__new_works` (
	`id`, `slug`, `character_name`, `species`, `suit_type`, `purpose`,
	`adoption_method`, `business_status`, `event_name`, `event_time`,
	`owner_display`, `owner_contact`, `price_amount_minor`, `price_currency`,
	`publication_status`, `sort_order`, `featured`, `version`, `published_at`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `slug`, `character_name`, `species`, `suit_type`, `purpose`,
	`adoption_method`, `business_status`,
	-- 只有 event_drop 才保留历史展会名称；其他作品一律置空，
	-- 避免带着与新 CHECK 冲突的僵尸值迁移过来。
	CASE
		WHEN `purpose` = 'adoption' AND `adoption_method` = 'event_drop'
			AND `current_event_name` IS NOT NULL
			AND length(trim(`current_event_name`)) > 0
		THEN `current_event_name`
		ELSE NULL
	END,
	NULL,
	`owner_display`, `owner_contact`, `price_amount_minor`, `price_currency`,
	`publication_status`, `sort_order`, `featured`, `version`, `published_at`,
	`created_at`, `updated_at`
FROM `works`;--> statement-breakpoint
DROP TABLE `works`;--> statement-breakpoint
ALTER TABLE `__new_works` RENAME TO `works`;--> statement-breakpoint
CREATE UNIQUE INDEX `works_slug_unique` ON `works` (`slug`);--> statement-breakpoint
CREATE INDEX `works_publication_sort_idx` ON `works` (`publication_status`,`sort_order`);--> statement-breakpoint
CREATE TRIGGER `works_preserve_enabled_hero_link`
BEFORE UPDATE OF `publication_status` ON `works`
WHEN NEW.`publication_status` != 'published' AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1 AND `linked_work_id` = OLD.`id`
)
BEGIN
  SELECT RAISE(ABORT, 'published work is linked by an enabled hero slide');
END;
--> statement-breakpoint
CREATE TRIGGER `works_preserve_design_sheet_purpose`
BEFORE UPDATE OF `purpose` ON `works`
WHEN NEW.`purpose` != 'adoption' AND EXISTS (
  SELECT 1 FROM `work_assets`
  WHERE `work_id` = OLD.`id` AND `role` = 'design_sheet'
)
BEGIN
  SELECT RAISE(ABORT, 'design sheet requires an adoption work');
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
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
END;
--> statement-breakpoint
CREATE TRIGGER `return_photos_published_work_insert`
BEFORE INSERT ON `return_photos`
WHEN NEW.`publication_status` = 'published' AND NOT EXISTS (
  SELECT 1 FROM `works`
  WHERE `id` = NEW.`work_id` AND `publication_status` = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'published return photo requires a published work');
END;
--> statement-breakpoint
CREATE TRIGGER `return_photos_published_work_update`
BEFORE UPDATE OF `publication_status`, `work_id` ON `return_photos`
WHEN NEW.`publication_status` = 'published'
  AND (
    OLD.`publication_status` != 'published'
    OR NEW.`work_id` != OLD.`work_id`
  )
  AND NOT EXISTS (
    SELECT 1 FROM `works`
    WHERE `id` = NEW.`work_id` AND `publication_status` = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'published return photo requires a published work');
END;
--> statement-breakpoint
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
  OR (
    NEW.`owner_type` = 'return'
    AND NOT EXISTS (
      SELECT 1 FROM `return_photos`
      WHERE `id` = NEW.`owner_id` AND `version` = NEW.`owner_version`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;
--> statement-breakpoint
CREATE TRIGGER `work_assets_role_immutable`
BEFORE UPDATE OF `role` ON `work_assets`
WHEN NEW.`role` != OLD.`role`
BEGIN
  SELECT RAISE(ABORT, 'work asset role changes require relation replacement');
END;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
