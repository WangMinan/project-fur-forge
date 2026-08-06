-- T34-F5：长任务 lease、heartbeat、attempt 与启动恢复。
--
-- 使用 ALTER TABLE ADD COLUMN 而不是 12 步表重建：新增列不会重新校验既有 CHECK，
-- 也不会丢掉 0016 建立的 publication_operations 失败态触发器与实体索引。
--
-- attempt 语义：行创建时为 0；runner 每次在事务内抢到 lease 时 +1。
-- 因此首次执行 attempt=1，进程被杀后接管为 attempt=2。
-- lease_owner 是进程实例标识（主机名/pid/随机后缀），不是任何 Secret。

ALTER TABLE `publication_operations` ADD `attempt` integer DEFAULT 0 NOT NULL CHECK (`attempt` >= 0);--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `lease_owner` text CHECK (`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `lease_expires_at` integer;--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `heartbeat_at` integer;--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `recovery_reason` text CHECK (`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE'));--> statement-breakpoint
ALTER TABLE `publication_operations` ADD `next_retry_at` integer;--> statement-breakpoint

ALTER TABLE `watermark_operations` ADD `attempt` integer DEFAULT 0 NOT NULL CHECK (`attempt` >= 0);--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD `lease_owner` text CHECK (`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD `lease_expires_at` integer;--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD `heartbeat_at` integer;--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD `recovery_reason` text CHECK (`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE'));--> statement-breakpoint
ALTER TABLE `watermark_operations` ADD `next_retry_at` integer;--> statement-breakpoint

-- 启动恢复扫描按 lease 到期时间取非终止任务，不做全表扫描。
CREATE INDEX `publication_operations_lease_idx` ON `publication_operations` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `watermark_operations_lease_idx` ON `watermark_operations` (`status`,`lease_expires_at`);
