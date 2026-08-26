-- R4 Stage E: 只替换空值或精确历史默认，保留管理员自定义文案。
UPDATE `site_content`
SET
	`commission_estimate_note` = '请使用提交委托申请按钮提供清晰的设定图和个人基本信息，如果工作室确认接单，我们将使用官方 QQ 与你进一步沟通。',
	`commission_content_version` = `commission_content_version` + 1,
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND (
	`commission_estimate_note` IS NULL
	OR trim(`commission_estimate_note`) = ''
	OR `commission_estimate_note` = '站内表单请提供清晰的角色设定图、称呼、物种、身高和体重。工作室完成初步评估后，会在官方 QQ 中继续确认希望制作的装型、细节和期望时间；提交申请不代表已经接单，也不构成最终报价或排期确认。'
	OR `commission_estimate_note` = '每个角色都不一样，所以这里没有固定价目表。申请时请附上清晰的设定图，并填写称呼、物种、身高和体重；暂时拿不准装型或细节也没关系，确认能接之后再一起商量。'
);
