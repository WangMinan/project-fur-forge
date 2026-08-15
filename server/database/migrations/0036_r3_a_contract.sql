-- R3-A Contract：必须先完成对象/版本/delete marker/ESA 清理。
-- 空的全新数据库可直接前进；任何既有退役数据都要求 T03 成功审计标记。
CREATE TEMP TABLE `__r3_a_contract_guard` (
  `ready` integer NOT NULL CONSTRAINT `r3_a_cleanup_required` CHECK (`ready` = 1)
);--> statement-breakpoint
INSERT INTO `__r3_a_contract_guard` (`ready`)
SELECT CASE WHEN
  EXISTS (
    SELECT 1 FROM `audit_logs`
    WHERE `action` = 'R3_STAGE_A_OBJECT_CLEANUP'
      AND `entity_type` = 'stage_a_retirement'
      AND `entity_id` = 'object_cleanup'
      AND `result` = 'SUCCESS'
  )
  OR (
    NOT EXISTS (SELECT 1 FROM `updates`)
    AND NOT EXISTS (SELECT 1 FROM `return_characters`)
    AND NOT EXISTS (SELECT 1 FROM `return_photos`)
    AND NOT EXISTS (SELECT 1 FROM `assets` WHERE `role` = 'return_photo')
    AND NOT EXISTS (
      SELECT 1 FROM `upload_sessions`
      WHERE `owner_type` = 'return' OR `media_role` = 'return_photo'
    )
    AND NOT EXISTS (
      SELECT 1 FROM `asset_variants`
      WHERE `media_role` = 'return_photo'
        OR `usage` = 'return-wall'
        OR `recipe_version` = 'return-display-v1'
    )
    AND NOT EXISTS (
      SELECT 1 FROM `publication_operations`
      WHERE `entity_type` = 'RETURN_PHOTO'
    )
    AND NOT EXISTS (
      SELECT 1 FROM `analytics_events`
      WHERE `route_key` IN ('returns', 'return_character', 'updates')
        OR `entity_type` = 'return_character'
    )
    AND NOT EXISTS (
      SELECT 1 FROM json_each(`official_channels_json`) AS channel
      WHERE json_extract(channel.value, '$.platform') IN ('douyin', 'xiaohongshu', 'bilibili')
        AND json_extract(channel.value, '$.qrCodeAssetId') IS NOT NULL
    )
  )
THEN 1 ELSE 0 END
FROM `site_content` WHERE `id` = 'site';--> statement-breakpoint
DROP TABLE `__r3_a_contract_guard`;--> statement-breakpoint

PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

-- 在关系仍存在时固定本次允许删除的资产集合；只保存临时 ID，不持久化 Key。
CREATE TEMP TABLE `__r3_a_retired_assets` (`id` text PRIMARY KEY NOT NULL);--> statement-breakpoint
INSERT OR IGNORE INTO `__r3_a_retired_assets` (`id`)
SELECT `id` FROM `assets` WHERE `role` = 'return_photo';--> statement-breakpoint
INSERT OR IGNORE INTO `__r3_a_retired_assets` (`id`)
SELECT `asset_id` FROM `return_photos` WHERE `asset_id` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `__r3_a_retired_assets` (`id`)
SELECT json_extract(retired.value, '$.qrCodeAssetId')
FROM `site_content`, json_each(`official_channels_json`) AS retired
JOIN `assets` ON `assets`.`id` = json_extract(retired.value, '$.qrCodeAssetId')
  AND `assets`.`role` = 'contact_qr'
WHERE `site_content`.`id` = 'site'
  AND json_extract(retired.value, '$.platform') IN ('douyin', 'xiaohongshu', 'bilibili')
  AND json_extract(retired.value, '$.qrCodeAssetId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM json_each(`site_content`.`official_channels_json`) AS retained
    WHERE json_extract(retained.value, '$.platform') IN ('qq', 'qq_group')
      AND json_extract(retained.value, '$.qrCodeAssetId') = json_extract(retired.value, '$.qrCodeAssetId')
  )
  AND NOT EXISTS (SELECT 1 FROM `work_assets` WHERE `asset_id` = `assets`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `watermark_profiles` WHERE `source_asset_id` = `assets`.`id`)
  AND NOT EXISTS (
    SELECT 1 FROM `site_hero_slides`
    WHERE `landscape_asset_id` = `assets`.`id` OR `portrait_asset_id` = `assets`.`id`
  );--> statement-breakpoint

DELETE FROM `upload_sessions`
WHERE `owner_type` = 'return' OR `media_role` = 'return_photo'
  OR `asset_id` IN (SELECT `id` FROM `__r3_a_retired_assets`);--> statement-breakpoint
DELETE FROM `asset_variants`
WHERE `asset_id` IN (SELECT `id` FROM `__r3_a_retired_assets`)
  OR `media_role` = 'return_photo'
  OR `usage` = 'return-wall'
  OR `recipe_version` = 'return-display-v1';--> statement-breakpoint
DELETE FROM `publication_operations` WHERE `entity_type` = 'RETURN_PHOTO';--> statement-breakpoint
DELETE FROM `analytics_events`
WHERE `route_key` IN ('returns', 'return_character', 'updates')
  OR `entity_type` = 'return_character';--> statement-breakpoint
DELETE FROM `return_photos`;--> statement-breakpoint
DELETE FROM `return_characters`;--> statement-breakpoint
DELETE FROM `updates`;--> statement-breakpoint
DELETE FROM `assets` WHERE `id` IN (SELECT `id` FROM `__r3_a_retired_assets`);--> statement-breakpoint

UPDATE `site_content`
SET
  `about_studio_facts` = replace(`about_studio_facts`, '与返图', ''),
  `privacy_policy` = replace(
    replace(
      replace(`privacy_policy`, '邮件、QQ、抖音、QQ群、小红书或 Bilibili', '邮件、QQ 或 QQ群'),
      '可选的公开作品或返图 ID', '可选的公开作品 ID'
    ),
    '通过 QQ、抖音联系', '通过 QQ、QQ群联系'
  ),
  `contact_anti_scam` = replace(
    `contact_anti_scam`,
    '邮箱、QQ 和抖音号',
    '邮箱、QQ 和 QQ群'
  )
WHERE `id` = 'site';--> statement-breakpoint

DROP TABLE `return_photos`;--> statement-breakpoint
DROP TABLE `return_characters`;--> statement-breakpoint
DROP TABLE `updates`;--> statement-breakpoint

CREATE TABLE `__new_site_content` (
	`id` text PRIMARY KEY DEFAULT 'site' NOT NULL,
	`hero_tagline` text,
	`contact_email` text,
	`contact_qq` text,
	`official_channels_json` text DEFAULT '[{"platform":"qq","account":null,"qrCodeAssetId":null},{"platform":"qq_group","account":null,"qrCodeAssetId":null}]' NOT NULL,
	`commission_intro` text,
	`commission_estimate_note` text,
	`commission_email_action` text,
	`commission_faq_json` text,
	`about_studio_facts` text,
	`about_making_scope` text,
	`basic_terms` text,
	`privacy_policy` text,
	`contact_anti_scam` text,
	`hero_auto_rotate` integer DEFAULT false NOT NULL,
	`hero_auto_rotate_interval_ms` integer DEFAULT 6000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`commission_content_version` integer DEFAULT 1 NOT NULL,
	`commission_faq_version` integer DEFAULT 1 NOT NULL,
	`about_content_version` integer DEFAULT 1 NOT NULL,
	`terms_content_version` integer DEFAULT 1 NOT NULL,
	`privacy_content_version` integer DEFAULT 1 NOT NULL,
	`contact_content_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "site_content_singleton" CHECK(`id` = 'site'),
	CONSTRAINT "site_content_section_versions_positive" CHECK(`commission_content_version` > 0 AND `commission_faq_version` > 0 AND `about_content_version` > 0 AND `terms_content_version` > 0 AND `privacy_content_version` > 0 AND `contact_content_version` > 0),
	CONSTRAINT "site_content_tagline" CHECK(`hero_tagline` IS NULL OR length(trim(`hero_tagline`)) BETWEEN 1 AND 120),
	CONSTRAINT "site_content_rotation_interval" CHECK(`hero_auto_rotate_interval_ms` >= 6000),
	CONSTRAINT "site_content_commission_intro" CHECK(`commission_intro` IS NULL OR (length(trim(`commission_intro`)) BETWEEN 1 AND 240 AND `commission_intro` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_official_channels_json" CHECK(json_valid(`official_channels_json`) AND json_type(`official_channels_json`) = 'array' AND json_array_length(`official_channels_json`) = 2 AND json_extract(`official_channels_json`, '$[0].platform') = 'qq' AND json_extract(`official_channels_json`, '$[1].platform') = 'qq_group' AND length(`official_channels_json`) <= 2000),
	CONSTRAINT "site_content_commission_estimate_note" CHECK(`commission_estimate_note` IS NULL OR (length(trim(`commission_estimate_note`)) BETWEEN 1 AND 600 AND `commission_estimate_note` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_commission_email_action" CHECK(`commission_email_action` IS NULL OR (length(trim(`commission_email_action`)) BETWEEN 1 AND 240 AND `commission_email_action` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_commission_faq_json" CHECK(`commission_faq_json` IS NULL OR (json_valid(`commission_faq_json`) AND json_type(`commission_faq_json`) = 'array' AND length(`commission_faq_json`) <= 12000)),
	CONSTRAINT "site_content_about_studio_facts" CHECK(`about_studio_facts` IS NULL OR (length(trim(`about_studio_facts`)) BETWEEN 1 AND 1200 AND `about_studio_facts` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_about_making_scope" CHECK(`about_making_scope` IS NULL OR (length(trim(`about_making_scope`)) BETWEEN 1 AND 1200 AND `about_making_scope` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_basic_terms" CHECK(`basic_terms` IS NULL OR (length(trim(`basic_terms`)) BETWEEN 1 AND 8000 AND `basic_terms` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_privacy_policy" CHECK(`privacy_policy` IS NULL OR (length(trim(`privacy_policy`)) BETWEEN 1 AND 8000 AND `privacy_policy` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_contact_anti_scam" CHECK(`contact_anti_scam` IS NULL OR (length(trim(`contact_anti_scam`)) BETWEEN 1 AND 600 AND `contact_anti_scam` NOT GLOB '*[<>]*')),
	CONSTRAINT "site_content_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_site_content` (
  `id`, `hero_tagline`, `contact_email`, `contact_qq`, `official_channels_json`,
  `commission_intro`, `commission_estimate_note`, `commission_email_action`,
  `commission_faq_json`, `about_studio_facts`, `about_making_scope`,
  `basic_terms`, `privacy_policy`, `contact_anti_scam`, `hero_auto_rotate`,
  `hero_auto_rotate_interval_ms`, `version`, `commission_content_version`,
  `commission_faq_version`, `about_content_version`, `terms_content_version`,
  `privacy_content_version`, `contact_content_version`, `created_at`, `updated_at`
)
SELECT
  `id`, `hero_tagline`, `contact_email`, `contact_qq`,
  json_array(
    json_object(
      'platform', 'qq',
      'account', (SELECT json_extract(value, '$.account') FROM json_each(`official_channels_json`) WHERE json_extract(value, '$.platform') = 'qq'),
      'qrCodeAssetId', (SELECT json_extract(value, '$.qrCodeAssetId') FROM json_each(`official_channels_json`) WHERE json_extract(value, '$.platform') = 'qq')
    ),
    json_object(
      'platform', 'qq_group',
      'account', (SELECT json_extract(value, '$.account') FROM json_each(`official_channels_json`) WHERE json_extract(value, '$.platform') = 'qq_group'),
      'qrCodeAssetId', (SELECT json_extract(value, '$.qrCodeAssetId') FROM json_each(`official_channels_json`) WHERE json_extract(value, '$.platform') = 'qq_group')
    )
  ),
  `commission_intro`, `commission_estimate_note`, `commission_email_action`,
  `commission_faq_json`, `about_studio_facts`, `about_making_scope`,
  `basic_terms`, `privacy_policy`, `contact_anti_scam`, `hero_auto_rotate`,
  `hero_auto_rotate_interval_ms`, `version` + 1, `commission_content_version`,
  `commission_faq_version`, `about_content_version`, `terms_content_version`,
  `privacy_content_version`, `contact_content_version` + 1, `created_at`,
  unixepoch() * 1000
FROM `site_content`;--> statement-breakpoint
DROP TABLE `site_content`;--> statement-breakpoint
ALTER TABLE `__new_site_content` RENAME TO `site_content`;--> statement-breakpoint

CREATE TABLE `__new_analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer NOT NULL,
	`event_type` text NOT NULL,
	`route_key` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`action_key` text,
	`session_hmac` text NOT NULL,
	CONSTRAINT "analytics_events_event_type" CHECK(`event_type` IN ('page_view', 'contact_action')),
	CONSTRAINT "analytics_events_route_key" CHECK(`route_key` IN ('home', 'works', 'work_detail', 'commission', 'adoptions', 'about', 'service', 'privacy', 'licenses')),
	CONSTRAINT "analytics_events_entity_type" CHECK(`entity_type` IS NULL OR `entity_type` = 'work'),
	CONSTRAINT "analytics_events_action_key" CHECK(`action_key` IS NULL OR `action_key` IN ('email_open', 'email_copy')),
	CONSTRAINT "analytics_events_session_hmac" CHECK(length(`session_hmac`) = 64 AND `session_hmac` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "analytics_events_shape" CHECK(CASE WHEN `event_type` = 'contact_action' THEN `route_key` IN ('about', 'commission') AND `action_key` IS NOT NULL AND `entity_type` IS NULL AND `entity_id` IS NULL WHEN `route_key` = 'work_detail' THEN `entity_type` = 'work' AND `entity_id` IS NOT NULL AND `action_key` IS NULL ELSE `entity_type` IS NULL AND `entity_id` IS NULL AND `action_key` IS NULL END)
);--> statement-breakpoint
INSERT INTO `__new_analytics_events` SELECT * FROM `analytics_events`;--> statement-breakpoint
DROP TABLE `analytics_events`;--> statement-breakpoint
ALTER TABLE `__new_analytics_events` RENAME TO `analytics_events`;--> statement-breakpoint
CREATE INDEX `analytics_events_occurred_idx` ON `analytics_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_type_occurred_idx` ON `analytics_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_route_occurred_idx` ON `analytics_events` (`route_key`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_entity_occurred_idx` ON `analytics_events` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint

DROP TRIGGER IF EXISTS `publication_operations_failure_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `publication_operations_failure_update`;--> statement-breakpoint
CREATE TABLE `__new_publication_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_type` text DEFAULT 'PUBLISH' NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`requested_version` integer NOT NULL,
	`status` text NOT NULL,
	`cleanup_object_keys_json` text DEFAULT '[]' NOT NULL,
	`edge_purge_urls_json` text DEFAULT '[]' NOT NULL,
	`edge_purge_task_id` text,
	`edge_purge_status` text DEFAULT 'NOT_REQUIRED' NOT NULL,
	`edge_purge_reason` text,
	`edge_purge_checked_at` integer,
	`internal_error_code` text,
	`internal_error_message` text,
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
	CONSTRAINT "publication_operations_attempt" CHECK(`attempt` >= 0),
	CONSTRAINT "publication_operations_lease_owner" CHECK(`lease_owner` IS NULL OR length(trim(`lease_owner`)) BETWEEN 1 AND 200),
	CONSTRAINT "publication_operations_recovery_reason" CHECK(`recovery_reason` IS NULL OR `recovery_reason` IN ('LEASE_EXPIRED', 'STARTUP_SCAN', 'ALREADY_COMMITTED', 'NOT_RESUMABLE')),
	CONSTRAINT "publication_operations_operation_type" CHECK(`operation_type` IN ('PUBLISH', 'UNPUBLISH', 'UPSCALE')),
	CONSTRAINT "publication_operations_entity_type" CHECK(`entity_type` IN ('WORK', 'HOME')),
	CONSTRAINT "publication_operations_status" CHECK(`status` IN ('PREPARING_SOURCE', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC', 'FAILED', 'DONE')),
	CONSTRAINT "publication_operations_requested_version" CHECK(`requested_version` > 0),
	CONSTRAINT "publication_operations_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('PREPARING_SOURCE', 'VALIDATING', 'GENERATING_PUBLIC', 'APPLYING_WATERMARK', 'VERIFYING_PUBLIC', 'COMMITTING', 'CLEANING_PUBLIC')),
	CONSTRAINT "publication_operations_failure_state" CHECK((`status` = 'FAILED' AND `internal_error_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `internal_error_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "publication_operations_edge_purge_status" CHECK(`edge_purge_status` IN ('NOT_REQUIRED', 'PENDING', 'PURGING', 'COMPLETE', 'FAILED')),
	CONSTRAINT "publication_operations_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_publication_operations` SELECT * FROM `publication_operations`;--> statement-breakpoint
DROP TABLE `publication_operations`;--> statement-breakpoint
ALTER TABLE `__new_publication_operations` RENAME TO `publication_operations`;--> statement-breakpoint
CREATE INDEX `publication_operations_entity_idx` ON `publication_operations` (`entity_type`,`entity_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `publication_operations_lease_idx` ON `publication_operations` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `publication_operations_edge_purge_idx` ON `publication_operations` (`edge_purge_status`,`updated_at`);--> statement-breakpoint
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
BEFORE UPDATE OF `status`, `internal_error_code`, `failure_stage` ON `publication_operations`
WHEN NOT (
  (NEW.`status` = 'FAILED' AND NEW.`internal_error_code` IS NOT NULL AND NEW.`failure_stage` IS NOT NULL)
  OR (NEW.`status` != 'FAILED' AND NEW.`internal_error_code` IS NULL AND NEW.`failure_stage` IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'publication operation failure state is invalid');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
CREATE TABLE `__new_upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_version` integer NOT NULL,
	`media_role` text NOT NULL,
	`private_object_key` text NOT NULL,
	`expected_content_type` text NOT NULL,
	`expected_bytes` integer NOT NULL,
	`expected_content_md5` text NOT NULL,
	`expected_sha256` text NOT NULL,
	`expected_width` integer NOT NULL,
	`expected_height` integer NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'AWAITING_UPLOAD' NOT NULL,
	`asset_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`failure_code` text,
	`failure_stage` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`cleaned_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "upload_sessions_owner_type" CHECK(`owner_type` IN ('work', 'site')),
	CONSTRAINT "upload_sessions_owner_id" CHECK(length(trim(`owner_id`)) > 0 AND (`owner_type` != 'site' OR `owner_id` IN ('home', 'branding', 'contact'))),
	CONSTRAINT "upload_sessions_owner_version" CHECK(`owner_version` >= 0),
	CONSTRAINT "upload_sessions_media_role" CHECK((`owner_type` = 'work' AND `media_role` IN ('design_sheet', 'studio_photo')) OR (`owner_type` = 'site' AND `owner_id` = 'home' AND `media_role` IN ('home_hero_landscape', 'home_hero_portrait')) OR (`owner_type` = 'site' AND `owner_id` = 'branding' AND `media_role` = 'watermark_logo') OR (`owner_type` = 'site' AND `owner_id` = 'contact' AND `media_role` = 'contact_qr')),
	CONSTRAINT "upload_sessions_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "upload_sessions_content_type" CHECK(`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "upload_sessions_watermark_logo_png" CHECK(`media_role` != 'watermark_logo' OR (`expected_content_type` = 'image/png' AND `expected_bytes` <= 20000000)),
	CONSTRAINT "upload_sessions_contact_qr_source" CHECK(`media_role` != 'contact_qr' OR (`expected_content_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `expected_bytes` <= 20000000 AND `expected_width` >= 64 AND `expected_height` >= 64)),
	CONSTRAINT "upload_sessions_expected_bytes" CHECK(`expected_bytes` BETWEEN 1 AND 30000000),
	CONSTRAINT "upload_sessions_expected_md5" CHECK(length(`expected_content_md5`) = 24),
	CONSTRAINT "upload_sessions_expected_sha256" CHECK(length(`expected_sha256`) = 64 AND `expected_sha256` = lower(`expected_sha256`) AND `expected_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "upload_sessions_expected_dimensions" CHECK(`expected_width` BETWEEN 1 AND 12000 AND `expected_height` BETWEEN 1 AND 12000),
	CONSTRAINT "upload_sessions_status" CHECK(`status` IN ('AWAITING_UPLOAD', 'VALIDATING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "upload_sessions_asset_state" CHECK((`status` = 'COMPLETED' AND `asset_id` IS NOT NULL) OR (`status` != 'COMPLETED' AND `asset_id` IS NULL)),
	CONSTRAINT "upload_sessions_failure_state" CHECK((`status` = 'FAILED' AND `failure_code` IS NOT NULL AND `failure_stage` IS NOT NULL) OR (`status` != 'FAILED' AND `failure_code` IS NULL AND `failure_stage` IS NULL)),
	CONSTRAINT "upload_sessions_failure_stage" CHECK(`failure_stage` IS NULL OR `failure_stage` IN ('HEAD', 'DIGEST', 'IMAGE_INFO', 'PREPROCESS', 'DATABASE', 'CLEANUP')),
	CONSTRAINT "upload_sessions_expiry" CHECK(`expires_at` = `created_at` + 300000),
	CONSTRAINT "upload_sessions_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_upload_sessions` SELECT * FROM `upload_sessions`;--> statement-breakpoint
DROP TABLE `upload_sessions`;--> statement-breakpoint
ALTER TABLE `__new_upload_sessions` RENAME TO `upload_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_sessions_private_object_key_unique` ON `upload_sessions` (`private_object_key`);--> statement-breakpoint
CREATE INDEX `upload_sessions_owner_idx` ON `upload_sessions` (`owner_type`,`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`status`,`expires_at`);--> statement-breakpoint
CREATE TRIGGER `upload_sessions_identity_immutable`
BEFORE UPDATE OF
  `owner_type`, `owner_id`, `owner_version`, `media_role`,
  `private_object_key`, `expected_content_type`, `expected_bytes`,
  `expected_content_md5`, `expected_sha256`, `expected_width`,
  `expected_height`, `created_by`, `created_at`, `expires_at`
ON `upload_sessions`
WHEN
  NEW.`owner_type` != OLD.`owner_type`
  OR NEW.`owner_id` != OLD.`owner_id`
  OR NEW.`owner_version` != OLD.`owner_version`
  OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`expected_content_type` != OLD.`expected_content_type`
  OR NEW.`expected_bytes` != OLD.`expected_bytes`
  OR NEW.`expected_content_md5` != OLD.`expected_content_md5`
  OR NEW.`expected_sha256` != OLD.`expected_sha256`
  OR NEW.`expected_width` != OLD.`expected_width`
  OR NEW.`expected_height` != OLD.`expected_height`
  OR NEW.`created_by` != OLD.`created_by`
  OR NEW.`created_at` != OLD.`created_at`
  OR NEW.`expires_at` != OLD.`expires_at`
BEGIN
  SELECT RAISE(ABORT, 'upload session identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_owner_insert`
BEFORE INSERT ON `upload_sessions`
WHEN
  (NEW.`owner_type` = 'work' AND NOT EXISTS (
    SELECT 1 FROM `works` WHERE `id` = NEW.`owner_id`
      AND `version` = NEW.`owner_version`
      AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
  ))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'home'
    AND NEW.`owner_version` != COALESCE((SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (SELECT `version` FROM `site_branding` WHERE `id` = 'site'))
  OR (NEW.`owner_type` = 'site' AND NEW.`owner_id` = 'contact'
    AND NEW.`owner_version` != COALESCE((SELECT `contact_content_version` FROM `site_content` WHERE `id` = 'site'), 0))
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;--> statement-breakpoint

DROP TRIGGER IF EXISTS `assets_original_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `assets_preserve_enabled_hero`;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`private_object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`exif_orientation` integer DEFAULT 1 NOT NULL,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`fit_mode` text DEFAULT 'cover' NOT NULL,
	`watermark_anchor` text DEFAULT 'top-left' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "assets_role" CHECK(`role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'watermark_logo', 'contact_qr')),
	CONSTRAINT "assets_status" CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "assets_private_key_relative" CHECK(length(trim(`private_object_key`)) > 0 AND instr(`private_object_key`, '://') = 0 AND substr(`private_object_key`, 1, 1) != '/'),
	CONSTRAINT "assets_sha256" CHECK(length(`sha256`) = 64 AND `sha256` = lower(`sha256`) AND `sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "assets_byte_size" CHECK(`byte_size` BETWEEN 1 AND 30000000),
	CONSTRAINT "assets_dimensions" CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
	CONSTRAINT "assets_exif_orientation" CHECK(`exif_orientation` BETWEEN 1 AND 8),
	CONSTRAINT "assets_focus" CHECK(`focal_x` BETWEEN 0 AND 1 AND `focal_y` BETWEEN 0 AND 1),
	CONSTRAINT "assets_fit_mode" CHECK(`fit_mode` IN ('cover', 'contain')),
	CONSTRAINT "assets_watermark_anchor" CHECK(`watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
	CONSTRAINT "assets_hero_orientation" CHECK((`role` != 'home_hero_landscape' OR `width` > `height`) AND (`role` != 'home_hero_portrait' OR `height` > `width`)),
	CONSTRAINT "assets_mime_type" CHECK(`mime_type` IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "assets_watermark_logo_png" CHECK(`role` != 'watermark_logo' OR (`mime_type` = 'image/png' AND `byte_size` <= 20000000)),
	CONSTRAINT "assets_contact_qr_source" CHECK(`role` != 'contact_qr' OR (`mime_type` IN ('image/jpeg', 'image/png', 'image/webp') AND `byte_size` <= 20000000 AND `width` >= 64 AND `height` >= 64 AND `fit_mode` = 'contain')),
	CONSTRAINT "assets_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_assets` SELECT * FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_private_object_key_unique` ON `assets` (`private_object_key`);--> statement-breakpoint
CREATE TRIGGER `assets_original_identity_immutable`
BEFORE UPDATE OF `role`, `private_object_key`, `sha256`, `byte_size`, `mime_type`, `width`, `height`, `exif_orientation`
ON `assets`
WHEN
  NEW.`role` != OLD.`role`
  OR NEW.`private_object_key` != OLD.`private_object_key`
  OR NEW.`sha256` != OLD.`sha256`
  OR NEW.`byte_size` != OLD.`byte_size`
  OR NEW.`mime_type` != OLD.`mime_type`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`exif_orientation` != OLD.`exif_orientation`
BEGIN
  SELECT RAISE(ABORT, 'original asset identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `assets_preserve_enabled_hero`
BEFORE UPDATE OF `status`, `role` ON `assets`
WHEN (NEW.`status` != 'READY' OR NEW.`role` != OLD.`role`) AND EXISTS (
  SELECT 1 FROM `site_hero_slides`
  WHERE `enabled` = 1
    AND (`landscape_asset_id` = OLD.`id` OR `portrait_asset_id` = OLD.`id`)
)
BEGIN
  SELECT RAISE(ABORT, 'enabled hero slide requires READY assets');
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_identity_immutable`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_role_usage_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_watermark_profile_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_source_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preprocess_limit_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `asset_variants_preserve_source`;--> statement-breakpoint
CREATE TABLE `__new_asset_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`source_variant_id` text,
	`storage_scope` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`object_key` text NOT NULL,
	`input_sha256` text NOT NULL,
	`media_role` text NOT NULL,
	`usage` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text NOT NULL,
	`quality` integer NOT NULL,
	`crop_identity` text NOT NULL,
	`recipe_version` text NOT NULL,
	`protection_mode` text DEFAULT 'watermark' NOT NULL,
	`watermark_profile` text NOT NULL,
	`watermark_profile_id` text,
	`watermark_config_digest` text DEFAULT 'none' NOT NULL,
	`logo_digest` text NOT NULL,
	`watermark_anchor` text NOT NULL,
	`watermark_opacity_percent` integer,
	`watermark_scale_percent` integer,
	`sha256` text,
	`byte_size` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`internal_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_variant_id`) REFERENCES `asset_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`watermark_profile_id`) REFERENCES `watermark_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "asset_variants_storage_scope" CHECK(`storage_scope` IN ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "asset_variants_status" CHECK(`status` IN ('PENDING', 'READY', 'FAILED')),
	CONSTRAINT "asset_variants_key_relative" CHECK(length(trim(`object_key`)) > 0 AND instr(`object_key`, '://') = 0 AND substr(`object_key`, 1, 1) != '/'),
	CONSTRAINT "asset_variants_input_sha256" CHECK(length(`input_sha256`) = 64 AND `input_sha256` = lower(`input_sha256`) AND `input_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "asset_variants_media_role" CHECK(`media_role` IN ('design_sheet', 'studio_photo', 'home_hero_landscape', 'home_hero_portrait', 'contact_qr')),
	CONSTRAINT "asset_variants_usage" CHECK(`usage` IN ('preprocess', 'work-card', 'detail', 'design-sheet', 'home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption', 'contact-qr')),
	CONSTRAINT "asset_variants_dimensions" CHECK(`width` BETWEEN 1 AND 12000 AND `height` BETWEEN 1 AND 12000),
	CONSTRAINT "asset_variants_format" CHECK(`format` IN ('webp', 'jpeg', 'png')),
	CONSTRAINT "asset_variants_quality" CHECK(`quality` BETWEEN 1 AND 100),
	CONSTRAINT "asset_variants_identity_text" CHECK(length(trim(`crop_identity`)) > 0 AND length(trim(`recipe_version`)) > 0 AND length(trim(`watermark_profile`)) > 0),
	CONSTRAINT "asset_variants_logo_digest" CHECK(`logo_digest` = 'none' OR (length(`logo_digest`) = 64 AND `logo_digest` = lower(`logo_digest`) AND `logo_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_watermark_anchor" CHECK(`watermark_anchor` IN ('none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
	CONSTRAINT "asset_variants_watermark_config_digest" CHECK(`watermark_config_digest` = 'none' OR (length(`watermark_config_digest`) = 64 AND `watermark_config_digest` = lower(`watermark_config_digest`) AND `watermark_config_digest` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT "asset_variants_protection_mode" CHECK(`protection_mode` IN ('none', 'watermark')),
	CONSTRAINT "asset_variants_unprotected_identity" CHECK(`protection_mode` != 'none' OR (`watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_site_display_recipe" CHECK(`recipe_version` NOT IN ('site-display-v1', 'site-display-v2') OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` IN ('home-hero-landscape', 'home-hero-portrait', 'commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption'))),
	CONSTRAINT "asset_variants_site_display_usage" CHECK(`usage` NOT IN ('commission-hero-landscape', 'commission-hero-portrait', 'home-entry-commission', 'home-entry-adoption') OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` IN ('site-display-v1', 'site-display-v2'))),
	CONSTRAINT "asset_variants_public_protection" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` = 'watermark' OR `recipe_version` IN ('site-display-v1', 'site-display-v2', 'contact-qr-v1')),
	CONSTRAINT "asset_variants_contact_qr_recipe" CHECK(`recipe_version` != 'contact-qr-v1' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `usage` = 'contact-qr' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
	CONSTRAINT "asset_variants_contact_qr_usage" CHECK(`usage` != 'contact-qr' OR (`storage_scope` = 'PUBLIC' AND `protection_mode` = 'none' AND `recipe_version` = 'contact-qr-v1' AND `media_role` = 'contact_qr' AND `format` = 'png' AND `width` = `height`)),
	CONSTRAINT "asset_variants_contact_qr_role" CHECK(`media_role` != 'contact_qr' OR `usage` IN ('preprocess', 'contact-qr')),
	CONSTRAINT "asset_variants_public_watermark" CHECK(`storage_scope` != 'PUBLIC' OR `protection_mode` != 'watermark' OR ((`watermark_profile` = 'brand-standard-v1' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` != 'none' AND `watermark_anchor` IN ('top-left', 'top-right', 'bottom-left', 'bottom-right') AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL) OR (`watermark_profile` = 'brand-centered-v2' AND `watermark_profile_id` IS NOT NULL AND `watermark_config_digest` != 'none' AND `logo_digest` != 'none' AND `watermark_anchor` = 'center' AND `watermark_opacity_percent` BETWEEN 10 AND 90 AND `watermark_scale_percent` BETWEEN 20 AND 90))),
	CONSTRAINT "asset_variants_preprocess_private" CHECK(`usage` != 'preprocess' OR (`storage_scope` = 'PRIVATE' AND `protection_mode` = 'none' AND `watermark_profile` = 'none' AND `watermark_profile_id` IS NULL AND `watermark_config_digest` = 'none' AND `logo_digest` = 'none' AND `watermark_anchor` = 'none' AND `watermark_opacity_percent` IS NULL AND `watermark_scale_percent` IS NULL)),
	CONSTRAINT "asset_variants_private_unprotected" CHECK(`storage_scope` != 'PRIVATE' OR `protection_mode` = 'none'),
	CONSTRAINT "asset_variants_ready_output" CHECK(`status` != 'READY' OR (`sha256` IS NOT NULL AND length(`sha256`) = 64 AND `byte_size` > 0)),
	CONSTRAINT "asset_variants_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint
INSERT INTO `__new_asset_variants` SELECT * FROM `asset_variants`;--> statement-breakpoint
DROP TABLE `asset_variants`;--> statement-breakpoint
ALTER TABLE `__new_asset_variants` RENAME TO `asset_variants`;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_object_key_unique` ON `asset_variants` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_legacy_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile`,`logo_digest`,`watermark_anchor`) WHERE `watermark_profile_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `asset_variants_profile_identity_unique` ON `asset_variants` (`asset_id`,`input_sha256`,`media_role`,`usage`,`width`,`height`,`format`,`quality`,`crop_identity`,`recipe_version`,`watermark_profile_id`,`watermark_config_digest`,`logo_digest`,`watermark_anchor`,`watermark_opacity_percent`,`watermark_scale_percent`) WHERE `watermark_profile_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_variants_public_lookup_idx` ON `asset_variants` (`asset_id`,`storage_scope`,`status`,`usage`);--> statement-breakpoint
CREATE INDEX `asset_variants_protection_idx` ON `asset_variants` (`storage_scope`,`protection_mode`,`usage`,`status`);--> statement-breakpoint
CREATE TRIGGER `asset_variants_identity_immutable`
BEFORE UPDATE OF
  `asset_id`, `source_variant_id`, `storage_scope`, `object_key`,
  `input_sha256`, `media_role`, `usage`, `width`, `height`, `format`,
  `quality`, `crop_identity`, `recipe_version`, `protection_mode`,
  `watermark_profile`, `watermark_profile_id`, `watermark_config_digest`,
  `logo_digest`, `watermark_anchor`, `watermark_opacity_percent`,
  `watermark_scale_percent`
ON `asset_variants`
WHEN
  NEW.`asset_id` != OLD.`asset_id`
  OR NEW.`source_variant_id` IS NOT OLD.`source_variant_id`
  OR NEW.`storage_scope` != OLD.`storage_scope`
  OR NEW.`object_key` != OLD.`object_key`
  OR NEW.`input_sha256` != OLD.`input_sha256`
  OR NEW.`media_role` != OLD.`media_role`
  OR NEW.`usage` != OLD.`usage`
  OR NEW.`width` != OLD.`width`
  OR NEW.`height` != OLD.`height`
  OR NEW.`format` != OLD.`format`
  OR NEW.`quality` != OLD.`quality`
  OR NEW.`crop_identity` != OLD.`crop_identity`
  OR NEW.`recipe_version` != OLD.`recipe_version`
  OR NEW.`protection_mode` != OLD.`protection_mode`
  OR NEW.`watermark_profile` != OLD.`watermark_profile`
  OR NEW.`watermark_profile_id` IS NOT OLD.`watermark_profile_id`
  OR NEW.`watermark_config_digest` != OLD.`watermark_config_digest`
  OR NEW.`logo_digest` != OLD.`logo_digest`
  OR NEW.`watermark_anchor` != OLD.`watermark_anchor`
  OR NEW.`watermark_opacity_percent` IS NOT OLD.`watermark_opacity_percent`
  OR NEW.`watermark_scale_percent` IS NOT OLD.`watermark_scale_percent`
BEGIN
  SELECT RAISE(ABORT, 'asset variant identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_role_usage_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  NEW.`media_role` != (SELECT `role` FROM `assets` WHERE `id` = NEW.`asset_id`)
  OR NOT (
    (NEW.`media_role` = 'studio_photo' AND NEW.`usage` IN ('preprocess', 'work-card', 'detail'))
    OR (NEW.`media_role` = 'design_sheet' AND NEW.`usage` IN ('preprocess', 'work-card', 'design-sheet', 'detail', 'home-entry-adoption'))
    OR (NEW.`media_role` = 'home_hero_landscape' AND NEW.`usage` IN ('preprocess', 'home-hero-landscape', 'commission-hero-landscape', 'home-entry-commission'))
    OR (NEW.`media_role` = 'home_hero_portrait' AND NEW.`usage` IN ('preprocess', 'home-hero-portrait', 'commission-hero-portrait'))
    OR (NEW.`media_role` = 'contact_qr' AND NEW.`usage` IN ('preprocess', 'contact-qr'))
  )
BEGIN
  SELECT RAISE(ABORT, 'variant role and usage are incompatible');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_watermark_profile_insert`
BEFORE INSERT ON `asset_variants`
WHEN NEW.`watermark_profile_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `watermark_profiles`
  WHERE `id` = NEW.`watermark_profile_id`
    AND `profile_name` = NEW.`watermark_profile`
    AND `config_digest` = NEW.`watermark_config_digest`
    AND `logo_digest` = NEW.`logo_digest`
    AND `position` = NEW.`watermark_anchor`
    AND `opacity_percent` = NEW.`watermark_opacity_percent`
    AND `scale_percent` = NEW.`watermark_scale_percent`
    AND `status` IN ('APPLYING', 'ACTIVE')
)
BEGIN
  SELECT RAISE(ABORT, 'variant watermark profile is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_source_insert`
BEFORE INSERT ON `asset_variants`
WHEN
  (NEW.`usage` = 'preprocess' AND NEW.`source_variant_id` IS NOT NULL)
  OR (NEW.`usage` = 'preprocess' AND (NEW.`width` > 4096 OR NEW.`height` > 4096 OR (NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000)))
  OR (NEW.`source_variant_id` IS NULL AND NEW.`input_sha256` != (SELECT `sha256` FROM `assets` WHERE `id` = NEW.`asset_id`))
  OR (NEW.`source_variant_id` IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `asset_variants` AS source
    WHERE source.`id` = NEW.`source_variant_id`
      AND source.`asset_id` = NEW.`asset_id`
      AND source.`storage_scope` = 'PRIVATE'
      AND source.`status` = 'READY'
      AND source.`usage` = 'preprocess'
      AND source.`media_role` = NEW.`media_role`
      AND source.`sha256` = NEW.`input_sha256`
      AND source.`byte_size` <= 20000000
      AND source.`width` <= 4096
      AND source.`height` <= 4096
  ))
  OR (NEW.`storage_scope` = 'PUBLIC'
    AND (SELECT `byte_size` FROM `assets` WHERE `id` = NEW.`asset_id`) > 20000000
    AND NEW.`source_variant_id` IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'variant processing source is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preprocess_limit_update`
BEFORE UPDATE OF `status`, `byte_size` ON `asset_variants`
WHEN NEW.`usage` = 'preprocess' AND NEW.`status` = 'READY' AND NEW.`byte_size` > 20000000
BEGIN
  SELECT RAISE(ABORT, 'preprocess variant exceeds OSS input limits');
END;--> statement-breakpoint
CREATE TRIGGER `asset_variants_preserve_source`
BEFORE UPDATE OF `status`, `sha256`, `byte_size` ON `asset_variants`
WHEN EXISTS (
  SELECT 1 FROM `asset_variants` AS downstream
  WHERE downstream.`source_variant_id` = OLD.`id`
) AND (
  NEW.`status` != OLD.`status`
  OR NEW.`sha256` IS NOT OLD.`sha256`
  OR NEW.`byte_size` IS NOT OLD.`byte_size`
)
BEGIN
  SELECT RAISE(ABORT, 'referenced processing source is immutable');
END;--> statement-breakpoint

DROP TABLE `__r3_a_retired_assets`;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
PRAGMA foreign_keys=ON;
