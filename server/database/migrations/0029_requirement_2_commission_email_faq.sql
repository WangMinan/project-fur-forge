UPDATE `site_content`
SET `commission_faq_json` = json_insert(
      COALESCE(`commission_faq_json`, '[]'),
      '$[#]',
      json_object(
        'id', '2f7c23c4-8e8a-4cc4-a8c5-3a8f3b8e9d61',
        'question', '邮件估价咨询可以按什么格式填写？',
        'answer', '请将邮件标题写为“角色名 + 委托估价”，正文依次填写：角色名、委托装型、身高/体型、设定图、希望实现的细节、期望时间和其它说明。设定图可作为邮件附件发送，工作室会根据资料人工回复估价。'
      )
    ),
    `commission_faq_version` = `commission_faq_version` + 1,
    `updated_at` = unixepoch() * 1000
WHERE `id` = 'site'
  AND json_array_length(COALESCE(`commission_faq_json`, '[]')) < 9
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(COALESCE(`site_content`.`commission_faq_json`, '[]')) AS `faq`
    WHERE json_extract(`faq`.`value`, '$.id') = '2f7c23c4-8e8a-4cc4-a8c5-3a8f3b8e9d61'
  );
