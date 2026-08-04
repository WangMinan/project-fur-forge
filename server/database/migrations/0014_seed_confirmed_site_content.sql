UPDATE `site_content`
SET
  `commission_intro` = COALESCE(
    `commission_intro`,
    '从角色设定出发，制作全装与半装兽装。每个委托都会结合设定细节和实际需求单独沟通、逐单估价。'
  ),
  `commission_estimate_note` = COALESCE(
    `commission_estimate_note`,
    '咨询时请尽量提供清晰的角色设定图、希望制作的装型（全装或半装）、身高体型信息和其他明确需求。工作室会根据角色细节、制作范围与实现难度进行人工评估，再通过邮件回复方案与报价。本站不提供自动报价，页面也不代表固定排期。'
  ),
  `commission_email_action` = COALESCE(
    `commission_email_action`,
    '发送邮件时可在主题中写明“自设委托 + 角色名”，并附上设定图与需求说明。若暂时无法打开邮件客户端，可复制邮箱后在常用邮箱中发送。'
  ),
  `commission_faq_json` = COALESCE(
    `commission_faq_json`,
    '[{"question":"咨询委托前需要准备什么？","answer":"请准备清晰的角色设定图，并说明希望制作全装还是半装、身高体型信息及其他明确需求。资料越完整，越方便工作室判断实现方式并回复估价。"},{"question":"目前可以委托哪些装型？","answer":"当前页面公开展示全装与半装；半装由头、爪和尾巴组成。网站暂不列出单个配件委托，其他需求是否接受请以工作室邮件回复为准。"},{"question":"委托价格如何确定？","answer":"价格会根据角色细节、制作范围和实现难度逐单人工评估。本站不提供自动报价，也不把单件作品价格当作统一价目。"},{"question":"制作周期如何确认？","answer":"具体周期会在工作室了解需求并确认方案后单独说明；公开页面不承诺固定排期。"},{"question":"确认方案后还能修改设定吗？","answer":"建议在确认制作前完成主要设定调整；开工后的修改范围、费用和可行性需要与工作室另行确认。"}]'
  ),
  `about_studio_facts` = COALESCE(
    `about_studio_facts`,
    '有点小狗工作室是一家以兽装作品为核心的制作工作室。我们希望把角色设定转化为可以穿戴、展示和记录的实体作品。'
  ),
  `about_making_scope` = COALESCE(
    `about_making_scope`,
    '目前公开展示的制作范围包括全装与半装。全装覆盖头部、身体、爪和尾巴；半装由头、爪和尾巴组成。具体结构、细节与实现方式会根据角色设定和双方确认的需求单独评估。'
  ),
  `basic_terms` = COALESCE(
    `basic_terms`,
    '1. 报价与协商。每件作品均单独报价，不设置统一固定价格。具体制作周期、付款比例、付款节点、交付方式及其他未列事项，以工作室与客户通过邮件最终确认的内容为准。

2. 领养作品权利。工作室原创的角色设定图、展示图片、具体兽装造型及其他可受著作权法保护的创作成果，其著作权均归有点小狗工作室所有。领养人完成付款与交付后，取得实体兽装的所有权，以及用于个人展示、扮演、拍摄等非商业用途的使用权；未经工作室书面许可，不得复制、改编、复刻、授权第三方制作或用于商业用途。

3. 自设委托权利。委托人原先合法拥有的角色设定权利仍归原权利人；工作室根据该设定创作的具体兽装造型、制作方案、展示图片及其他可受著作权法保护的创作成果，其著作权归有点小狗工作室所有。委托人完成付款与交付后，取得实体兽装的所有权，以及工作室创作成果用于个人、非商业用途的使用权；未经工作室书面许可，不得复制、改编、复刻、授权第三方制作或用于商业用途。

4. 实物与著作权。实体兽装的交付或所有权转移，不代表工作室著作权转移。工作室保留对作品进行拍摄、展示、发布和用于工作室宣传的权利；如需延后公开，应在确认委托前通过邮件另行约定。

5. 修改。请在确认制作前核对设定图、配色和特殊细节。开工后的修改范围、费用和可行性需要另行协商。

6. 保修。保修期自客户签收之日起一年。保修期内，工作室对正常使用中发生的非人为损坏提供免费维修，往返运费由客户承担；人为损坏按实际情况收取材料与工时费。保修仅覆盖工作室制作的作品主体，不包括客户自行制作或由第三方制作的配件与服饰。

7. 官方渠道。请只通过本网站列出的官方渠道核验沟通对象。本站不提供站内付款或自动报价。'
  ),
  `contact_anti_scam` = COALESCE(
    `contact_anti_scam`,
    '工作室当前公开渠道以本网站列出的邮箱、QQ 和抖音号为准。沟通中如遇临时更换账号、要求向陌生个人账户付款或催促提供敏感信息，请先通过两个已公开渠道交叉核验。本站不提供站内付款或自动报价。'
  ),
  `version` = `version` + 1,
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site'
  AND (
    `commission_intro` IS NULL
    OR `commission_estimate_note` IS NULL
    OR `commission_email_action` IS NULL
    OR `commission_faq_json` IS NULL
    OR `about_studio_facts` IS NULL
    OR `about_making_scope` IS NULL
    OR `basic_terms` IS NULL
    OR `contact_anti_scam` IS NULL
  );
--> statement-breakpoint
INSERT OR IGNORE INTO `business_statuses` (
  `kind`, `tone`, `label`, `detail`, `href`, `version`, `created_at`, `updated_at`
) VALUES (
  'commission', 'limited', '委托咨询开放',
  '可通过邮件发送设定图与需求，是否接单及排期以工作室回复为准。',
  '/commission', 1, unixepoch() * 1000, unixepoch() * 1000
);
--> statement-breakpoint
INSERT OR IGNORE INTO `business_statuses` (
  `kind`, `tone`, `label`, `detail`, `href`, `version`, `created_at`, `updated_at`
) VALUES (
  'adoption', 'limited', '领养信息以页面为准',
  '当前可领养角色会在领养页公开显示；如页面没有角色，即表示暂无可领养内容。',
  '/adoptions', 1, unixepoch() * 1000, unixepoch() * 1000
);
