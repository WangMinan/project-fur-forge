-- R4: 领养全局营业状态退役；委托只保留开放/暂停，公开状态不再维护短说明。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint

CREATE TABLE `__new_business_statuses` (
	`kind` text PRIMARY KEY NOT NULL,
	`tone` text NOT NULL,
	`label` text NOT NULL,
	`href` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "business_statuses_kind" CHECK(`kind` IN ('commission')),
	CONSTRAINT "business_statuses_tone" CHECK(`tone` IN ('open', 'closed')),
	CONSTRAINT "business_statuses_text" CHECK(length(trim(`label`)) > 0),
	CONSTRAINT "business_statuses_href" CHECK(`kind` = 'commission' AND `href` = '/commission'),
	CONSTRAINT "business_statuses_version_positive" CHECK(`version` > 0)
);--> statement-breakpoint

INSERT INTO `__new_business_statuses` (
	`kind`, `tone`, `label`, `href`, `version`, `created_at`, `updated_at`
)
SELECT
	`kind`,
	CASE WHEN `tone` = 'closed' THEN 'closed' ELSE 'open' END,
	CASE WHEN `label` = '委托咨询开放' THEN '接受委托中' ELSE `label` END,
	'/commission',
	`version`,
	`created_at`,
	`updated_at`
FROM `business_statuses`
WHERE `kind` = 'commission';--> statement-breakpoint

DROP TABLE `business_statuses`;--> statement-breakpoint
ALTER TABLE `__new_business_statuses` RENAME TO `business_statuses`;--> statement-breakpoint

INSERT OR IGNORE INTO `business_statuses` (
	`kind`, `tone`, `label`, `href`, `version`, `created_at`, `updated_at`
) VALUES (
	'commission', 'open', '接受委托中', '/commission', 1,
	unixepoch() * 1000, unixepoch() * 1000
);--> statement-breakpoint

-- 只替换空值或 0045 写入的仓库默认，管理员自定义文案保持不变。
UPDATE `site_content`
SET
	`commission_intro` = CASE
		WHEN `commission_intro` IS NULL OR trim(`commission_intro`) = ''
			OR `commission_intro` = '提交设定图和基本信息后，工作室会先评估是否可接，并优先通过官方 QQ 与你沟通制作方案和报价。'
			THEN '先把角色设定和想做的范围发给我们。看过设定后，我们会确认是否能接，再通过官方 QQ 细聊做法、价格和排期。'
		ELSE `commission_intro`
	END,
	`commission_estimate_note` = CASE
		WHEN `commission_estimate_note` IS NULL OR trim(`commission_estimate_note`) = ''
			OR `commission_estimate_note` = '站内表单请提供清晰的角色设定图、称呼、物种、身高和体重。工作室完成初步评估后，会在官方 QQ 中继续确认希望制作的装型、细节和期望时间；提交申请不代表已经接单，也不构成最终报价或排期确认。'
			THEN '每个角色都不一样，所以这里没有固定价目表。申请时请附上清晰的设定图，并填写称呼、物种、身高和体重；暂时拿不准装型或细节也没关系，确认能接之后再一起商量。'
		ELSE `commission_estimate_note`
	END,
	`commission_email_action` = CASE
		WHEN `commission_email_action` IS NULL OR trim(`commission_email_action`) = ''
			OR `commission_email_action` = '邮箱为备用联系渠道。委托申请请优先使用站内表单；后续沟通和逐单确认以本网站公布的工作室官方 QQ 私聊为主。'
			THEN '建议先提交站内申请；如果表单暂时无法使用，也可以发邮件。'
		ELSE `commission_email_action`
	END,
	`commission_content_version` = `commission_content_version` + 1,
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND (
	`commission_intro` IS NULL OR trim(`commission_intro`) = ''
	OR `commission_intro` = '提交设定图和基本信息后，工作室会先评估是否可接，并优先通过官方 QQ 与你沟通制作方案和报价。'
	OR `commission_estimate_note` IS NULL OR trim(`commission_estimate_note`) = ''
	OR `commission_estimate_note` = '站内表单请提供清晰的角色设定图、称呼、物种、身高和体重。工作室完成初步评估后，会在官方 QQ 中继续确认希望制作的装型、细节和期望时间；提交申请不代表已经接单，也不构成最终报价或排期确认。'
	OR `commission_email_action` IS NULL OR trim(`commission_email_action`) = ''
	OR `commission_email_action` = '邮箱为备用联系渠道。委托申请请优先使用站内表单；后续沟通和逐单确认以本网站公布的工作室官方 QQ 私聊为主。'
);
