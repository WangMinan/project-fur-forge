ALTER TABLE works ADD COLUMN show_adoption_cover_in_detail integer NOT NULL DEFAULT 1 CONSTRAINT works_show_cover CHECK(show_adoption_cover_in_detail IN (0,1));--> statement-breakpoint
ALTER TABLE works ADD COLUMN show_design_sheet_in_detail integer NOT NULL DEFAULT 1 CONSTRAINT works_show_design CHECK(show_design_sheet_in_detail IN (0,1));--> statement-breakpoint
ALTER TABLE works ADD COLUMN adoption_cover_source text NOT NULL DEFAULT 'auto' CONSTRAINT works_cover_source CHECK(adoption_cover_source IN ('auto','adoption_cover','design_sheet'));--> statement-breakpoint
ALTER TABLE works ADD COLUMN image_composition_version integer NOT NULL DEFAULT 0 CONSTRAINT works_composition_version CHECK(image_composition_version IN (0,1));--> statement-breakpoint
CREATE TABLE work_asset_compositions (
 work_id text NOT NULL,
 asset_id text NOT NULL,
 usage text NOT NULL CHECK(usage IN ('detail-thumbnail','work-catalog','home-featured','adoption-catalog','home-adoption')),
 mode text NOT NULL CHECK(mode IN ('crop','contain')),
 x real, y real, width real, height real,
 PRIMARY KEY(work_id,asset_id,usage),
 FOREIGN KEY(work_id,asset_id) REFERENCES work_assets(work_id,asset_id) ON DELETE CASCADE,
 CHECK((mode='contain' AND usage!='detail-thumbnail' AND x IS NULL AND y IS NULL AND width IS NULL AND height IS NULL) OR
 (mode='crop' AND x IS NOT NULL AND y IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND x>=0 AND y>=0 AND width>0 AND height>0 AND x+width<=1 AND y+height<=1))
);--> statement-breakpoint
CREATE TABLE `__new_asset_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `asset_id` text NOT NULL REFERENCES `assets`(`id`) ON DELETE cascade,
  `source_variant_id` text REFERENCES `asset_variants`(`id`),
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
  `sha256` text,
  `byte_size` integer,
  `version` integer DEFAULT 1 NOT NULL,
  `internal_error_code` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `asset_variants_storage_scope` CHECK(`storage_scope` IN ('PRIVATE', 'PUBLIC')),
  CONSTRAINT `asset_variants_status` CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
  CONSTRAINT `asset_variants_key_relative` CHECK(length(trim(`object_key`)) > 0 AND instr(`object_key`, '://') = 0 AND substr(`object_key`, 1, 1) != '/'),
  CONSTRAINT `asset_variants_input_sha256` CHECK(length(`input_sha256`) = 64 AND `input_sha256` = lower(`input_sha256`) AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT `asset_variants_media_role` CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'adoption_cover', 'commission_design_reference', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')),
  CONSTRAINT `asset_variants_usage` CHECK(`usage` IN ('detail-thumbnail', 'work-catalog', 'home-featured', 'adoption-catalog', 'home-adoption', 'preprocess', 'work-card', 'adoption-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'contact-qr')),
  CONSTRAINT `asset_variants_dimensions` CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
  CONSTRAINT `asset_variants_format` CHECK(`format` IN ('webp', 'jpeg', 'png')),
  CONSTRAINT `asset_variants_quality` CHECK(`quality` BETWEEN 1 AND 100),
  CONSTRAINT `asset_variants_identity_text` CHECK(length(trim(`crop_identity`)) > 0 AND length(trim(`recipe_version`)) > 0),
  CONSTRAINT `asset_variants_site_display_recipe` CHECK(`recipe_version` NOT IN ('site-display-v1', 'site-display-v2') OR (`storage_scope` = 'PUBLIC' AND `usage` IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))),
  CONSTRAINT `asset_variants_site_display_usage` CHECK(`usage` NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (`storage_scope` = 'PUBLIC' AND `recipe_version` IN ('site-display-v1', 'site-display-v2'))),
  CONSTRAINT `asset_variants_commission_private` CHECK(`media_role` != 'commission_design_reference' OR `storage_scope` = 'PRIVATE'),
  CONSTRAINT `asset_variants_contact_qr_recipe` CHECK(`recipe_version` != 'contact-qr-v1' OR (`storage_scope` = 'PUBLIC' AND `usage` = 'contact-qr' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
  CONSTRAINT `asset_variants_contact_qr_usage` CHECK(`usage` != 'contact-qr' OR (`storage_scope` = 'PUBLIC' AND `recipe_version` = 'contact-qr-v1' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
  CONSTRAINT `asset_variants_contact_qr_role` CHECK(`media_role` != 'contact_qr' OR `usage` IN ('preprocess', 'contact-qr')),
  CONSTRAINT `asset_variants_preprocess_private` CHECK(`usage` != 'preprocess' OR `storage_scope` = 'PRIVATE'),
  CONSTRAINT `asset_variants_ready_output` CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
  CONSTRAINT `asset_variants_version_positive` CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_asset_variants` SELECT * FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`);--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF `asset_id`, `source_variant_id`, `storage_scope`, `object_key`, `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`, `quality`, `crop_identity`, `recipe_version`
ON `asset_variants`
WHEN NEW.`asset_id` != OLD.`asset_id` OR NEW.`source_variant_id` IS NOT OLD.`source_variant_id`
  OR NEW.`storage_scope` != OLD.`storage_scope` OR NEW.`object_key` != OLD.`object_key`
  OR NEW.`input_sha256` != OLD.`input_sha256` OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`usage` != OLD.`usage` OR NEW.`width` != OLD.`width` OR NEW.`height` != OLD.`height`
  OR NEW.`format` != OLD.`format` OR NEW.`quality` != OLD.`quality`
  OR NEW.`crop_identity` != OLD.`crop_identity` OR NEW.`recipe_version` != OLD.`recipe_version`
BEGIN SELECT RAISE(ABORT, 'asset variant identity is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN NEW.`usage` = 'preprocess' AND NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000
BEGIN SELECT RAISE(ABORT, 'preprocess variant exceeds OSS input limits'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preserve_source`
BEFORE UPDATE OF `status`, `sha256`, `byte_size` ON `asset_variants`
WHEN EXISTS (SELECT 1 FROM `asset_variants` AS downstream WHERE downstream.`source_variant_id` = OLD.`id`)
  AND (NEW.`status` != OLD.`status` OR NEW.`sha256` IS NOT OLD.`sha256` OR NEW.`byte_size` IS NOT OLD.`byte_size`)
BEGIN SELECT RAISE(ABORT, 'referenced processing source is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`media_role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR NOT (
    (NEW.`media_role` = 'studio_photo' AND NEW.`usage` IN ('preprocess', 'work-card', 'detail', 'detail-thumbnail', 'work-catalog', 'home-featured'))
    OR (NEW.`media_role` = 'design_sheet' AND NEW.`usage` IN ('preprocess', 'design-sheet', 'detail-thumbnail', 'work-catalog', 'adoption-catalog', 'home-adoption'))
    OR (NEW.`media_role` = 'adoption_cover' AND NEW.`usage` IN ('preprocess', 'adoption-card', 'home-entry-adoption', 'detail', 'detail-thumbnail', 'work-catalog', 'adoption-catalog', 'home-adoption'))
    OR (NEW.`media_role` = 'commission_design_reference' AND NEW.`usage` = 'preprocess')
    OR (NEW.`media_role` = 'home_hero_landscape' AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait' AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'contact_qr' AND NEW.`usage` IN ('preprocess', 'contact-qr'))
  )
BEGIN SELECT RAISE(ABORT, 'variant role and usage are incompatible'); END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (NEW.`usage` = 'preprocess' AND ((NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)
    OR ((NEW.`width` > 4096 OR NEW.`height` > 4096) AND NOT (
      (NEW.`media_role` IN ('studio_photo', 'adoption_cover') AND NEW.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
      OR (NEW.`media_role` = 'design_sheet' AND NEW.`recipe_version` = 'design-sheet-upscale-lanczos-v1')
    ))))
  OR (NEW.`source_variant_id` IS NULL AND NEW.`input_sha256` != (SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`))
  OR (NEW.`source_variant_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `asset_variants` AS source
    WHERE source.`id` = NEW.`source_variant_id` AND source.`asset_id` = NEW.`asset_id`
      AND source.`storage_scope` = 'PRIVATE' AND source.`status` = 'READY'
      AND source.`usage` = 'preprocess' AND source.`media_role` = NEW.`media_role`
      AND source.`sha256` = NEW.`input_sha256` AND source.`byte_size` <= 20000000
      AND ((source.`width` <= 4096 AND source.`height` <= 4096)
        OR (source.`media_role` IN ('studio_photo', 'adoption_cover') AND source.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
        OR (source.`media_role` = 'design_sheet' AND source.`recipe_version` = 'design-sheet-upscale-lanczos-v1'))
  ))
  OR (NEW.`storage_scope` = 'PUBLIC' AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000 AND NEW.`source_variant_id` IS NULL)
BEGIN SELECT RAISE(ABORT, 'variant processing source is invalid'); END;
