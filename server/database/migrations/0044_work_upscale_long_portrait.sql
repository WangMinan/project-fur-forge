-- 作品适配后的长竖图可能在满足 2400px 公开详情宽度时超过旧的 4096px
-- preprocess 长边。只为固定的作品 Lanczos 配方放行该尺寸，20MB OSS 输入上限
-- 以及其它 preprocess 的 4096px 上限保持不变。
DROP TRIGGER IF EXISTS `asset_variants_source_insert`;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (
    NEW.`usage` = 'preprocess'
    AND (
      (NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)
      OR (
        (NEW.`width` > 4096 OR NEW.`height` > 4096)
        AND NOT (
          (NEW.`media_role` = 'studio_photo'
            AND NEW.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
          OR (NEW.`media_role` = 'design_sheet'
            AND NEW.`recipe_version` = 'design-sheet-upscale-lanczos-v1')
        )
      )
    )
  )
  OR (NEW.`source_variant_id` IS NULL AND NEW.`input_sha256` != (SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`))
  OR (NEW.`source_variant_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `asset_variants` AS source
    WHERE source.`id` = NEW.`source_variant_id`
      AND source.`asset_id` = NEW.`asset_id`
      AND source.`storage_scope` = 'PRIVATE'
      AND source.`status` = 'READY'
      AND source.`usage` = 'preprocess'
      AND source.`media_role` = NEW.`media_role`
      AND source.`sha256` = NEW.`input_sha256`
      AND source.`byte_size` <= 20000000
      AND (
        (source.`width` <= 4096 AND source.`height` <= 4096)
        OR (source.`media_role` = 'studio_photo'
          AND source.`recipe_version` = 'studio-photo-upscale-lanczos-v1')
        OR (source.`media_role` = 'design_sheet'
          AND source.`recipe_version` = 'design-sheet-upscale-lanczos-v1')
      )
  ))
  OR (NEW.`storage_scope` = 'PUBLIC'
    AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000
    AND NEW.`source_variant_id` IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
END;
