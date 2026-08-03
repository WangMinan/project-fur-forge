CREATE TRIGGER `work_assets_role_immutable`
BEFORE UPDATE OF `role` ON `work_assets`
WHEN NEW.`role` != OLD.`role`
BEGIN
  SELECT RAISE(ABORT, 'work asset role changes require relation replacement');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_design_sheet_primary_insert`
BEFORE INSERT ON `work_assets`
WHEN NEW.`role` = 'design_sheet' AND NEW.`is_primary` != 0
BEGIN
  SELECT RAISE(ABORT, 'design sheet cannot be a studio-photo primary');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_design_sheet_primary_update`
BEFORE UPDATE OF `is_primary`, `role` ON `work_assets`
WHEN NEW.`role` = 'design_sheet' AND NEW.`is_primary` != 0
BEGIN
  SELECT RAISE(ABORT, 'design sheet cannot be a studio-photo primary');
END;
