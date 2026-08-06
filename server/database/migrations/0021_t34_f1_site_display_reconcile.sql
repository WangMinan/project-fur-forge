-- T34-F1：既有站点展示素材 reconcile 的持久 operation。
--
-- 刻意使用独立表而不是扩展 publication_operations：后者的 entity_type /
-- operation_type CHECK 约束需要 12 步表重建才能加值，而重建会牵动 0016 建立的
-- 失败态触发器与实体索引。独立表列名与 lease 基础设施一致，因此
-- server/utils/operation-lease.ts 可以直接复用同一组语句。
--
-- scope 语义：一次 reconcile 覆盖的目标类别，便于运维只补某一类。
-- 计数列用于 dry-run 与运行摘要，只含数量，不含 Object Key。

CREATE TABLE `site_display_reconcile_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'all' NOT NULL,
	`status` text NOT NULL,
	`scanned_count` integer DEFAULT 0 NOT NULL,
	`generated_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`internal_error_code` text,
	`failure_stage` text,
	`version` integer DEFAULT 1 NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`heartbeat_at` integer,
	`recovery_reason` text,
	`next_retry_at` integer,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "site_display_reconcile_scope" CHECK(`scope` IN ('all', 'home-hero', 'commission-hero', 'home-entry')),
	CONSTRAINT "site_display_reconcile_status" CHECK(`status` IN ('SCANNING', 'GENERATING_PUBLIC', 'VERIFYING_PUBLIC', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "site_display_reconcile_counts" CHECK(`scanned_count` >= 0 AND `generated_count` >= 0 AND `skipped_count` >= 0 AND `failed_count` >= 0),
	CONSTRAINT "site_display_reconcile_failure_state" CHECK((`status` = 'FAILED' AND `internal_error_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `internal_error_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "site_display_reconcile_version_positive" CHECK(`version` > 0),
	CONSTRAINT "site_display_reconcile_attempt" CHECK(`attempt` >= 0),
	CONSTRAINT "site_display_reconcile_lease_owner" CHECK(`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200),
	CONSTRAINT "site_display_reconcile_recovery_reason" CHECK(`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE'))
);
--> statement-breakpoint
CREATE INDEX `site_display_reconcile_started_idx` ON `site_display_reconcile_operations` (`started_at`);--> statement-breakpoint
CREATE INDEX `site_display_reconcile_lease_idx` ON `site_display_reconcile_operations` (`status`,`lease_expires_at`);--> statement-breakpoint

-- 同时只允许一个未完成的 reconcile：避免两次运维命令并行生成同一批对象。
CREATE UNIQUE INDEX `site_display_reconcile_single_active`
ON `site_display_reconcile_operations` (`scope`)
WHERE `status` NOT IN ('FAILED', 'DONE');
