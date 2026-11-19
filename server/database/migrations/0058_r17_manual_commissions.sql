PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint
DROP TRIGGER commission_upload_sessions_consumed_submission;--> statement-breakpoint
CREATE TABLE `__new_commission_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_code` text NOT NULL,
	`nickname` text NOT NULL,
	`phone_country_code` text DEFAULT '+86' NOT NULL,
	`phone_number` text,
	`qq` text,
	`height_cm` integer,
	`weight_kg_tenths` integer,
	`design_asset_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`internal_note` text,
	`handled_at` integer,
	`handled_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
  species TEXT CHECK(species IS NULL OR (species = trim(species) AND length(species) BETWEEN 1 AND 50 AND species NOT GLOB '*[<>]*')),
  email_notification_policy TEXT NOT NULL DEFAULT 'legacy' CHECK(email_notification_policy IN ('legacy','enabled','disabled','unconfigured')),
  email_deletion_pending INTEGER NOT NULL DEFAULT 0 CHECK(email_deletion_pending IN (0,1)),
  deletion_lease_expires_at INTEGER CHECK(deletion_lease_expires_at IS NULL OR (email_deletion_pending = 1 AND deletion_lease_expires_at > 0)),
  origin TEXT NOT NULL DEFAULT 'website' CHECK(origin IN ('website','manual')),
  channel TEXT CHECK(channel IN ('qq','wechat','other')),
  channel_label TEXT CHECK(channel_label IS NULL OR length(trim(channel_label)) BETWEEN 1 AND 50),
  other_contact TEXT CHECK(other_contact IS NULL OR length(trim(other_contact)) BETWEEN 1 AND 200),
  original_applied_on TEXT,
  historical_handled_on TEXT,
  offline_adult_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(offline_adult_confirmed IN (0,1)),
  offline_privacy_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(offline_privacy_confirmed IN (0,1)),
  created_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT commission_origin_fields CHECK(
    (origin = 'website' AND phone_number IS NOT NULL AND qq IS NOT NULL AND height_cm IS NOT NULL AND weight_kg_tenths IS NOT NULL AND design_asset_id IS NOT NULL AND channel IS NULL)
    OR (origin = 'manual' AND channel IS NOT NULL AND created_by IS NOT NULL AND (phone_number IS NOT NULL OR qq IS NOT NULL OR other_contact IS NOT NULL)
      AND (channel != 'other' OR channel_label IS NOT NULL) AND (status != 'accepted' OR (offline_adult_confirmed = 1 AND offline_privacy_confirmed = 1)))) ,
	FOREIGN KEY (`design_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "commission_submissions_receipt" CHECK(`receipt_code` = upper(`receipt_code`) AND length(`receipt_code`) BETWEEN 8 AND 24 AND `receipt_code` NOT GLOB '*[^A-Z0-9-]*'),
	CONSTRAINT "commission_submissions_nickname" CHECK(`nickname` = trim(`nickname`) AND length(`nickname`) BETWEEN 1 AND 50),
	CONSTRAINT "commission_submissions_country" CHECK(`phone_country_code` = '+86'),
	CONSTRAINT "commission_submissions_phone" CHECK(length(`phone_number`) = 11 AND `phone_number` GLOB '1[3-9]*' AND `phone_number` NOT GLOB '*[^0-9]*'),
	CONSTRAINT "commission_submissions_qq" CHECK(substr(`qq`, 1, 1) BETWEEN '1' AND '9' AND length(`qq`) BETWEEN 5 AND 12 AND `qq` NOT GLOB '*[^0-9]*'),
	CONSTRAINT "commission_submissions_height" CHECK(`height_cm` BETWEEN 80 AND 250),
	CONSTRAINT "commission_submissions_weight" CHECK(`weight_kg_tenths` BETWEEN 200 AND 3000),
	CONSTRAINT "commission_submissions_status" CHECK(`status` IN ('pending', 'accepted', 'rejected')),
	CONSTRAINT "commission_submissions_note" CHECK(`internal_note` IS NULL OR (`internal_note` = trim(`internal_note`) AND length(`internal_note`) BETWEEN 1 AND 2000)),
	CONSTRAINT "commission_submissions_handled" CHECK((`status` = 'pending' AND `handled_at` IS NULL AND `handled_by` IS NULL) OR (`status` IN ('accepted', 'rejected') AND `handled_at` IS NOT NULL AND `handled_by` IS NOT NULL)),
	CONSTRAINT "commission_submissions_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO __new_commission_submissions (id,receipt_code,nickname,phone_country_code,phone_number,qq,height_cm,weight_kg_tenths,design_asset_id,status,internal_note,handled_at,handled_by,version,created_at,updated_at,species,email_notification_policy,email_deletion_pending,deletion_lease_expires_at) SELECT id,receipt_code,nickname,phone_country_code,phone_number,qq,height_cm,weight_kg_tenths,design_asset_id,status,internal_note,handled_at,handled_by,version,created_at,updated_at,species,email_notification_policy,email_deletion_pending,deletion_lease_expires_at FROM commission_submissions;--> statement-breakpoint
DROP TABLE commission_submissions;--> statement-breakpoint
ALTER TABLE __new_commission_submissions RENAME TO commission_submissions;--> statement-breakpoint
CREATE UNIQUE INDEX `commission_submissions_receipt_unique` ON `commission_submissions` (`receipt_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `commission_submissions_design_asset_unique` ON `commission_submissions` (`design_asset_id`);--> statement-breakpoint
CREATE INDEX `commission_submissions_status_created_idx` ON `commission_submissions` (`status`, `created_at`);--> statement-breakpoint
CREATE TRIGGER `commission_submissions_design_asset_insert`
BEFORE INSERT ON `commission_submissions`
WHEN NEW.`design_asset_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`design_asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission submission requires a ready design reference');
END;--> statement-breakpoint
CREATE TRIGGER `commission_submissions_design_asset_update`
BEFORE UPDATE OF `design_asset_id` ON `commission_submissions`
WHEN NEW.`design_asset_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`design_asset_id`
    AND `role` = 'commission_design_reference'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'commission submission requires a ready design reference');
END;--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_consumed_submission`
BEFORE UPDATE OF `status`, `asset_id` ON `commission_upload_sessions`
WHEN NEW.`status` = 'CONSUMED' AND NOT EXISTS (
  SELECT 1 FROM `commission_submissions`
  WHERE `design_asset_id` = NEW.`asset_id`
)
BEGIN
  SELECT RAISE(ABORT, 'consumed commission upload requires a submission');
END;--> statement-breakpoint


CREATE UNIQUE INDEX commission_submissions_pending_phone_unique ON commission_submissions(phone_country_code,phone_number) WHERE status='pending' AND origin='website';--> statement-breakpoint
CREATE INDEX commission_submissions_phone_idx ON commission_submissions(phone_number);--> statement-breakpoint
CREATE INDEX commission_submissions_qq_idx ON commission_submissions(qq);--> statement-breakpoint
ALTER TABLE commission_upload_sessions ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE commission_upload_sessions ADD COLUMN retired_at INTEGER;--> statement-breakpoint
CREATE TABLE commission_create_requests (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payload_hash TEXT,
  submission_id TEXT REFERENCES commission_submissions(id) ON DELETE SET NULL
);--> statement-breakpoint
CREATE TRIGGER commission_create_request_delete BEFORE DELETE ON commission_submissions
BEGIN UPDATE commission_create_requests SET payload_hash = NULL WHERE submission_id = OLD.id; END;--> statement-breakpoint
CREATE TRIGGER commission_origin_immutable BEFORE UPDATE OF origin ON commission_submissions
WHEN NEW.origin != OLD.origin BEGIN SELECT RAISE(ABORT,'commission origin is immutable'); END;--> statement-breakpoint
CREATE TRIGGER commission_manual_no_email BEFORE INSERT ON commission_email_notifications
WHEN EXISTS(SELECT 1 FROM commission_submissions WHERE id=NEW.submission_id AND origin='manual')
BEGIN SELECT RAISE(ABORT,'manual commission does not use email'); END;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
