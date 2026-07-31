ALTER TABLE `publication_operations` ADD `operation_type` text DEFAULT 'PUBLISH' NOT NULL CHECK (`operation_type` IN ('PUBLISH', 'UNPUBLISH'));--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `failure_stage` text CHECK (`failure_stage` IS NULL OR `failure_stage` IN ('VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC'));--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `version` integer DEFAULT 1 NOT NULL CHECK (`version` > 0);--> statement-breakpoint
UPDATE `publication_operations`
SET `failure_stage` = 'VALIDATING',
    `internal_error_code` = COALESCE(`internal_error_code`, 'LEGACY_FAILURE')
WHERE `status` = 'FAILED';--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_insert`
BEFORE INSERT ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_update`
BEFORE UPDATE OF `status`, `internal_error_code`, `failure_stage`
ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;
