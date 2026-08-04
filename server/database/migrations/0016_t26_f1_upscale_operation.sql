CREATE TABLE `__new_publication_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_type` text DEFAULT 'PUBLISH' NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`requested_version` integer NOT NULL,
	`status` text NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`internal_error_code` text,
	`internal_error_message` text,
	`failure_stage` text,
	`version` integer DEFAULT 1 NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "publication_operations_operation_type" CHECK(`operation_type` IN ('PUBLISH', 'UNPUBLISH', 'UPSCALE')),
	CONSTRAINT "publication_operations_entity_type" CHECK(`entity_type` IN ('WORK', 'HOME')),
	CONSTRAINT "publication_operations_status" CHECK(`status` IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "publication_operations_requested_version" CHECK(`requested_version` > 0),
	CONSTRAINT "publication_operations_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')),
	CONSTRAINT "publication_operations_failure_state" CHECK((`status` = 'FAILED' AND `internal_error_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `internal_error_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "publication_operations_version_positive" CHECK(`version` > 0)
);
--> statement-breakpoint
INSERT INTO `__new_publication_operations` (
	`id`, `operation_type`, `entity_type`, `entity_id`, `requested_version`,
	`status`, `cleanup_object_keys_json`, `internal_error_code`,
	`internal_error_message`, `failure_stage`, `version`, `started_at`,
	`updated_at`, `completed_at`
)
SELECT
	`id`, `operation_type`, `entity_type`, `entity_id`, `requested_version`,
	`status`, `cleanup_object_keys_json`, `internal_error_code`,
	`internal_error_message`, `failure_stage`, `version`, `started_at`,
	`updated_at`, `completed_at`
FROM `publication_operations`;
--> statement-breakpoint
DROP TABLE `publication_operations`;
--> statement-breakpoint
ALTER TABLE `__new_publication_operations` RENAME TO `publication_operations`;
--> statement-breakpoint
CREATE INDEX `publication_operations_entity_idx` ON `publication_operations` (`entity_type`,`entity_id`,`started_at`);
--> statement-breakpoint
CREATE TRIGGER `publication_operations_failure_insert`
BEFORE INSERT ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;
--> statement-breakpoint
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
