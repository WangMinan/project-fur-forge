ALTER TABLE `work_assets` ADD `alt_text` text;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_insert`
BEFORE INSERT ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (
  NEW.`alt_text` != trim(NEW.`alt_text`)
  OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500
)
BEGIN
  SELECT RAISE(ABORT, 'work asset alt text is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `work_assets_alt_update`
BEFORE UPDATE OF `alt_text` ON `work_assets`
WHEN NEW.`alt_text` IS NOT NULL AND (
  NEW.`alt_text` != trim(NEW.`alt_text`)
  OR length(NEW.`alt_text`) NOT BETWEEN 1 AND 500
)
BEGIN
  SELECT RAISE(ABORT, 'work asset alt text is invalid');
END;
