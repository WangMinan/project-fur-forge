CREATE TRIGGER `works_preserve_design_sheet_purpose`
BEFORE UPDATE OF `purpose` ON `works`
WHEN NEW.`purpose` != 'adoption' AND EXISTS (
  SELECT 1 FROM `work_assets`
  WHERE `work_id` = OLD.`id` AND `role` = 'design_sheet'
)
BEGIN
  SELECT RAISE(ABORT, 'design sheet requires an adoption work');
END;
