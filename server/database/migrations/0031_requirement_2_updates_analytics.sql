CREATE TABLE `analytics_events_next` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer NOT NULL,
	`event_type` text NOT NULL,
	`route_key` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`action_key` text,
	`session_hmac` text NOT NULL,
	CONSTRAINT "analytics_events_event_type" CHECK(`event_type` IN ('page_view', 'contact_action')),
	CONSTRAINT "analytics_events_route_key" CHECK(`route_key` IN ('home', 'works', 'work_detail', 'returns', 'return_character', 'commission', 'adoptions', 'updates', 'about', 'service', 'privacy', 'licenses')),
	CONSTRAINT "analytics_events_entity_type" CHECK(`entity_type` IS NULL OR `entity_type` IN ('work', 'return_character')),
	CONSTRAINT "analytics_events_action_key" CHECK(`action_key` IS NULL OR `action_key` IN ('email_open', 'email_copy')),
	CONSTRAINT "analytics_events_session_hmac" CHECK(length(`session_hmac`) = 64 AND `session_hmac` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "analytics_events_shape" CHECK(
		CASE
			WHEN `event_type` = 'contact_action'
				THEN `route_key` IN ('about', 'commission')
					AND `action_key` IS NOT NULL
					AND `entity_type` IS NULL
					AND `entity_id` IS NULL
			WHEN `route_key` = 'work_detail'
				THEN `entity_type` = 'work'
					AND `entity_id` IS NOT NULL
					AND `action_key` IS NULL
			WHEN `route_key` = 'return_character'
				THEN `entity_type` = 'return_character'
					AND `entity_id` IS NOT NULL
					AND `action_key` IS NULL
			ELSE `entity_type` IS NULL
				AND `entity_id` IS NULL
				AND `action_key` IS NULL
		END
	)
);
--> statement-breakpoint
INSERT INTO `analytics_events_next` (
	`id`, `occurred_at`, `event_type`, `route_key`, `entity_type`, `entity_id`, `action_key`, `session_hmac`
)
SELECT
	`id`, `occurred_at`, `event_type`, `route_key`, `entity_type`, `entity_id`, `action_key`, `session_hmac`
FROM `analytics_events`;
--> statement-breakpoint
DROP TABLE `analytics_events`;
--> statement-breakpoint
ALTER TABLE `analytics_events_next` RENAME TO `analytics_events`;
--> statement-breakpoint
CREATE INDEX `analytics_events_occurred_idx` ON `analytics_events` (`occurred_at`);
--> statement-breakpoint
CREATE INDEX `analytics_events_type_occurred_idx` ON `analytics_events` (`event_type`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `analytics_events_route_occurred_idx` ON `analytics_events` (`route_key`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `analytics_events_entity_occurred_idx` ON `analytics_events` (`entity_type`,`entity_id`,`occurred_at`);
