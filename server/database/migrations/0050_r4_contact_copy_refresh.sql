-- R4 Stage E：更新仍为仓库默认值的访客文案；管理员自定义文案保持不变。
UPDATE `site_content`
SET
	`commission_intro` = '先通过站内表单提交。工作室评估后优先使用官方 QQ 私聊沟通。',
	`commission_content_version` = `commission_content_version` + 1,
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND (
	`commission_intro` IS NULL
	OR trim(`commission_intro`) = ''
	OR `commission_intro` = '提交设定图和基本信息后，工作室会先评估是否可接，并优先通过官方 QQ 与你沟通制作方案和报价。'
	OR `commission_intro` = '先把角色设定和想做的范围发给我们。看过设定后，我们会确认是否能接，再通过官方 QQ 细聊做法、价格和排期。'
);--> statement-breakpoint

UPDATE `site_content`
SET
	`about_studio_facts` = CASE
		WHEN `about_studio_facts` IS NULL OR trim(`about_studio_facts`) = ''
			OR `about_studio_facts` = '有点小狗工作室制作全装和半装兽装，并在本站展示已完成的作品。'
			OR `about_studio_facts` = '有点小狗工作室制作全装与半装兽装。我们不只做小狗毛，但只做海绵头；从角色的轮廓、表情和毛色出发，把设定落实成可以穿戴、展示和记录的实体作品。'
			THEN '有点小狗工作室由景宸制作全装与半装兽装。我们不只做小狗毛！所有兽装头骨都是景宸制作的手削海绵头。欢迎在本站提交自设估价或者领养设定。'
		ELSE `about_studio_facts`
	END,
	`about_making_scope` = CASE
		WHEN `about_making_scope` IS NULL OR trim(`about_making_scope`) = ''
			OR `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装包括头部和爪。角色细节和制作方式会在确认委托前沟通。'
			OR `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装仅包括头部和爪，不含尾巴。具体结构、材料、细节与实现方式会在确认委托前通过工作室官方 QQ 沟通。'
			THEN '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装仅包括头部和爪。具体结构、材料、细节与实现方式会在确认委托前通过工作室官方 QQ 沟通。'
		ELSE `about_making_scope`
	END,
	`about_content_version` = `about_content_version` + 1,
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND (
	`about_studio_facts` IS NULL OR trim(`about_studio_facts`) = ''
	OR `about_studio_facts` = '有点小狗工作室制作全装和半装兽装，并在本站展示已完成的作品。'
	OR `about_studio_facts` = '有点小狗工作室制作全装与半装兽装。我们不只做小狗毛，但只做海绵头；从角色的轮廓、表情和毛色出发，把设定落实成可以穿戴、展示和记录的实体作品。'
	OR `about_making_scope` IS NULL OR trim(`about_making_scope`) = ''
	OR `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装包括头部和爪。角色细节和制作方式会在确认委托前沟通。'
	OR `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装仅包括头部和爪，不含尾巴。具体结构、材料、细节与实现方式会在确认委托前通过工作室官方 QQ 沟通。'
);--> statement-breakpoint

-- 防诈骗提醒已从公开端和管理端退役；保留兼容列但清空历史内容。
UPDATE `site_content`
SET
	`contact_anti_scam` = NULL,
	`contact_content_version` = `contact_content_version` + 1,
	`version` = `version` + 1,
	`updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND `contact_anti_scam` IS NOT NULL;
