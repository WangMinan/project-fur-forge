ALTER TABLE `publication_operations` ADD `edge_purge_urls_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `edge_purge_task_id` text;
--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `edge_purge_status` text NOT NULL DEFAULT 'NOT_REQUIRED' CONSTRAINT "publication_operations_edge_purge_status" CHECK(`edge_purge_status` IN ('NOT_REQUIRED', 'PENDING', 'PURGING', 'COMPLETE', 'FAILED'));
--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `edge_purge_reason` text;
--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `edge_purge_checked_at` integer;
--> statement-breakpoint
CREATE INDEX `publication_operations_edge_purge_idx` ON `publication_operations` (`edge_purge_status`,`updated_at`);
