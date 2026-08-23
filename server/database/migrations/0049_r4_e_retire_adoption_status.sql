-- R4-E: 领养营业状态彻底退役；委托营业状态只保留开放与不开放两档。
--
-- SQLite 无法修改既有 CHECK，因此重建 business_statuses：
--   kind 只允许 'commission'（删除 adoption 行）
--   tone 只允许 'open' / 'closed'（历史 'limited' 归一为 'open'）
--   href 只允许 '/commission'
-- 同时把第四幕导语与委托状态默认文案换成口语化版本。0048 已应用且 hash 已入库，
-- 不得回改，因此文案更新在本迁移里做。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

CREATE TABLE `__new_business_statuses` (
	`kind` text PRIMARY KEY NOT NULL,
	`tone` text NOT NULL,
	`label` text NOT NULL,
	`detail` text NOT NULL,
	`href` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "business_statuses_kind" CHECK(`kind` IN ('commission')),
	CONSTRAINT "business_statuses_tone" CHECK(`tone` IN ('open', 'closed')),
	CONSTRAINT "business_statuses_text" CHECK(length(trim(`label`)) > 0 AND length(trim(`detail`)) > 0),
	CONSTRAINT "business_statuses_href" CHECK(`kind` = 'commission' AND `href` = '/commission'),
	CONSTRAINT "business_statuses_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint

-- 只搬迁委托行；adoption 行随本次退役丢弃。'limited' 归一为 'open'。
INSERT INTO `__new_business_statuses` (
	`kind`, `tone`, `label`, `detail`, `href`, `version`, `created_at`, `updated_at`
)
SELECT
	`kind`,
	CASE WHEN `tone` = 'closed' THEN 'closed' ELSE 'open' END,
	`label`,
	`detail`,
	'/commission',
	`version`,
	`created_at`,
	`updated_at`
FROM `business_statuses`
WHERE `kind` = 'commission';--> statement-breakpoint

DROP TABLE `business_statuses`;--> statement-breakpoint
ALTER TABLE `__new_business_statuses` RENAME TO `business_statuses`;--> statement-breakpoint

-- 没有委托状态行时补一条默认开放；有则只替换仓库历史默认全文，不覆盖管理员自定义。
INSERT OR IGNORE INTO `business_statuses` (
	`kind`, `tone`, `label`, `detail`, `href`, `version`, `created_at`, `updated_at`
) VALUES (
	'commission', 'open', '现在可以接委托',
	'带上你的设定图来找我们聊，我们会看看能不能接，再一起把细节和排期定下来。',
	'/commission', 1, unixepoch() * 1000, unixepoch() * 1000
);--> statement-breakpoint

UPDATE `business_statuses`
SET
	`tone` = 'open',
	`label` = '现在可以接委托',
	`detail` = '带上你的设定图来找我们聊，我们会看看能不能接，再一起把细节和排期定下来。',
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `kind` = 'commission'
	AND `label` = '委托咨询开放'
	AND `detail` = '可通过邮件发送设定图与需求，是否接单及排期以工作室回复为准。';--> statement-breakpoint

-- 第四幕导语：0048 的默认值只在仍是那份历史默认时替换。
UPDATE `site_content`
SET
	`home_adoption_lead` = '这里有一些已经完成部分制作、等待领养的设定，也许其中就有你想成为的那个角色。',
	`home_copy_version` = `home_copy_version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site'
	AND (
		`home_adoption_lead` IS NULL
		OR `home_adoption_lead` = '设定领养包含了我们已经部分完成的作品，你也许可以在这里找到自己想成为的角色。'
	);
