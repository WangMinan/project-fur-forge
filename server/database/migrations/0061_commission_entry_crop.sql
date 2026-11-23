ALTER TABLE site_hero_items ADD COLUMN entry_crop_rect_json TEXT
  CHECK (entry_crop_rect_json IS NULL OR (placement = 'commission' AND orientation = 'landscape' AND json_valid(entry_crop_rect_json)));
--> statement-breakpoint
ALTER TABLE site_hero_items ADD COLUMN crop_adjusted INTEGER CHECK (crop_adjusted IN (0, 1));
