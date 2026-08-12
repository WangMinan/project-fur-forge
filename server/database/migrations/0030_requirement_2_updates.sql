CREATE TABLE `updates` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL CONSTRAINT "updates_type" CHECK(`type` IN ('event', 'drop', 'commission_open', 'other')),
	`title` text NOT NULL CONSTRAINT "updates_title" CHECK(`title` = trim(`title`) AND length(`title`) BETWEEN 1 AND 200),
	`content` text NOT NULL CONSTRAINT "updates_content" CHECK(`content` = trim(`content`) AND length(`content`) BETWEEN 1 AND 20000),
	`publication_status` text DEFAULT 'draft' NOT NULL CONSTRAINT "updates_publication_status" CHECK(`publication_status` IN ('draft', 'published', 'unpublished')),
	`published_at` integer,
	`version` integer DEFAULT 1 NOT NULL CONSTRAINT "updates_version_positive" CHECK(`version` > 0),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "updates_publication_time" CHECK((`publication_status` = 'draft' AND `published_at` IS NULL) OR (`publication_status` != 'draft' AND `published_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `updates_publication_published_idx` ON `updates` (`publication_status`,`published_at`);
