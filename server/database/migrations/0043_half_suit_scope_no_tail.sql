-- 用户补充契约：半装只做头和爪，不做尾巴。全装仍含尾巴。
-- 只替换仓库历史默认值（0014 初始稿与 0033 访客稿）；管理员已改写的文案保持不变。
UPDATE `site_content`
SET
  `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装包括头部和爪。角色细节和制作方式会在确认委托前沟通。',
  `about_content_version` = `about_content_version` + 1,
  `version` = `version` + 1,
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site'
  AND (
    `about_making_scope` = '目前制作全装与半装。全装包括头部、身体、爪和尾巴；半装包括头部、爪和尾巴。角色细节和制作方式会在确认委托前沟通。'
    OR `about_making_scope` = '目前公开展示的制作范围包括全装与半装。全装覆盖头部、身体、爪和尾巴；半装由头、爪和尾巴组成。具体结构、细节与实现方式会根据角色设定和双方确认的需求单独评估。'
  );
