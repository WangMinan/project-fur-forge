-- 用户补充契约：新申请必须填写物种；旧申请的真实物种不可猜测，保留 NULL 供管理端标记。
ALTER TABLE `commission_submissions`
ADD `species` text
CONSTRAINT `commission_submissions_species`
CHECK(
  `species` IS NULL OR (
    `species` = trim(`species`)
    AND length(`species`) BETWEEN 1 AND 50
    AND `species` NOT GLOB '*[<>]*'
  )
);--> statement-breakpoint

-- 若既有库已经存在同手机号的多条 pending 申请，此索引会让迁移原子失败并停止；
-- 不自动挑选、接受或拒绝任何真实申请。
CREATE UNIQUE INDEX `commission_submissions_pending_phone_unique`
ON `commission_submissions` (`phone_country_code`, `phone_number`)
WHERE `status` = 'pending';--> statement-breakpoint

-- 仅替换空值和仓库历史默认值；已由管理员维护的其它联系方式保持不变。
UPDATE `site_content`
SET
  `contact_email` = CASE
    WHEN `contact_email` IS NULL OR `contact_email` = '3114559925@qq.com'
      THEN '765678159@qq.com'
    ELSE `contact_email`
  END,
  `contact_qq` = CASE
    WHEN `contact_qq` IS NULL OR `contact_qq` = '3114559925'
      THEN '765678159'
    ELSE `contact_qq`
  END,
  `official_channels_json` = json_set(
    `official_channels_json`,
    '$[0].account', CASE
      WHEN json_extract(`official_channels_json`, '$[0].account') IS NULL
        OR json_extract(`official_channels_json`, '$[0].account') = '3114559925'
        THEN '765678159'
      ELSE json_extract(`official_channels_json`, '$[0].account')
    END,
    '$[1].account', CASE
      WHEN json_extract(`official_channels_json`, '$[1].account') IS NULL
        THEN '1040925427'
      ELSE json_extract(`official_channels_json`, '$[1].account')
    END
  ),
  `version` = `version` + 1,
  `contact_content_version` = `contact_content_version` + 1,
  `updated_at` = unixepoch() * 1000
WHERE `id` = 'site' AND (
  `contact_email` IS NULL
  OR `contact_email` = '3114559925@qq.com'
  OR `contact_qq` IS NULL
  OR `contact_qq` = '3114559925'
  OR json_extract(`official_channels_json`, '$[0].account') IS NULL
  OR json_extract(`official_channels_json`, '$[0].account') = '3114559925'
  OR json_extract(`official_channels_json`, '$[1].account') IS NULL
);
