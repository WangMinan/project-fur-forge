ALTER TABLE `asset_variants` ADD `source_variant_id` text REFERENCES asset_variants(id);--> statement-breakpoint
DROP TRIGGER `asset_variants_identity_immutable`;--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF
  `asset_id`, `source_variant_id`, `storage_scope`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`,
  `quality`, `crop_identity`, `recipe_version`, `watermark_profile`,
  `logo_digest`, `watermark_anchor`
ON `asset_variants`
WHEN
  NEW.`asset_id` != OLD.`asset_id`
  OR NEW.`source_variant_id` IS NOT OLD.`source_variant_id`
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
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN NOT (
  (NEW.`media_role` = 'studio_photo'
    AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
  OR (NEW.`media_role` = 'design_sheet'
    AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail'))
  OR (NEW.`media_role` = 'home_hero_landscape'
    AND NEW.`usage` IN ('preprocess', 'home-hero-landscape'))
  OR (NEW.`media_role` = 'home_hero_portrait'
    AND NEW.`usage` IN ('preprocess', 'home-hero-portrait'))
)
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_update`
BEFORE UPDATE OF `media_role`, `usage` ON `asset_variants`
WHEN NOT (
  (NEW.`media_role` = 'studio_photo'
    AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
  OR (NEW.`media_role` = 'design_sheet'
    AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail'))
  OR (NEW.`media_role` = 'home_hero_landscape'
    AND NEW.`usage` IN ('preprocess', 'home-hero-landscape'))
  OR (NEW.`media_role` = 'home_hero_portrait'
    AND NEW.`usage` IN ('preprocess', 'home-hero-portrait'))
)
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (
    NEW.`source_variant_id` IS NULL
    AND NEW.`input_sha256` != (
      SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`
    )
  )
  OR (
    NEW.`source_variant_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM `asset_variants` AS source
      WHERE source.`id` = NEW.`source_variant_id`
        AND source.`asset_id` = NEW.`asset_id`
        AND source.`storage_scope` = 'PRIVATE'
        AND source.`status` = 'READY'
        AND source.`usage` = 'preprocess'
        AND source.`sha256` = NEW.`input_sha256`
    )
  )
  OR (
    NEW.`storage_scope` = 'PUBLIC'
    AND (
      SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`
    ) > 20000000
    AND NEW.`source_variant_id` IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preserve_source`
BEFORE UPDATE OF `status`, `sha256`, `byte_size` ON `asset_variants`
WHEN EXISTS (
  SELECT 1
  FROM `asset_variants` AS downstream
  WHERE downstream.`source_variant_id` = OLD.`id`
) AND (
  NEW.`status` != OLD.`status`
  OR NEW.`sha256` IS NOT OLD.`sha256`
  OR NEW.`byte_size` IS NOT OLD.`byte_size`
)
BEGIN
  SELECT RAISE(ABORT, 'referenced processing source is immutable');
END;
