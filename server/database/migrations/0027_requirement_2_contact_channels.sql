ALTER TABLE `site_content` ADD `official_channels_json` text NOT NULL DEFAULT '[{"platform":"qq","account":null,"qrCodeAssetId":null},{"platform":"douyin","account":null,"qrCodeAssetId":null},{"platform":"qq_group","account":null,"qrCodeAssetId":null},{"platform":"xiaohongshu","account":null,"qrCodeAssetId":null},{"platform":"bilibili","account":null,"qrCodeAssetId":null}]' CONSTRAINT "site_content_official_channels_json" CHECK(json_valid(`official_channels_json`) AND json_type(`official_channels_json`) = 'array' AND json_array_length(`official_channels_json`) = 5 AND json_extract(`official_channels_json`, '$[0].platform') = 'qq' AND json_extract(`official_channels_json`, '$[1].platform') = 'douyin' AND json_extract(`official_channels_json`, '$[2].platform') = 'qq_group' AND json_extract(`official_channels_json`, '$[3].platform') = 'xiaohongshu' AND json_extract(`official_channels_json`, '$[4].platform') = 'bilibili' AND length(`official_channels_json`) <= 5000);
--> statement-breakpoint
UPDATE `site_content`
SET `official_channels_json` = json_array(
  json_object('platform', 'qq', 'account', `contact_qq`, 'qrCodeAssetId', NULL),
  json_object('platform', 'douyin', 'account', `contact_douyin`, 'qrCodeAssetId', NULL),
  json_object('platform', 'qq_group', 'account', NULL, 'qrCodeAssetId', NULL),
  json_object('platform', 'xiaohongshu', 'account', NULL, 'qrCodeAssetId', NULL),
  json_object('platform', 'bilibili', 'account', NULL, 'qrCodeAssetId', NULL)
)
WHERE `id` = 'site';
