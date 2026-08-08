-- T35-F1 返图与作品解耦：新增 return_characters（设定），把 return_photos
-- 从「一图一记录 + 必须挂已发布作品」改为「归属一个设定 + 可以有多张」。
--
-- 用户 Review 结论：返图就是返图。老作品没上过架、甚至没有作品记录，
-- 也可以有返图。因此：
--   * 设定有自己的名称、公开 slug 和可选 `@昵称`，不再借用作品名；
--   * 关联作品变为可选，作品被删除时只置空 `work_id`；
--   * 删除“已发布返图必须有已发布作品”的两个触发器；
--   * 去掉 `work_id` 与 `sort_order`（返图墙每次随机打乱，不需要人工排序）；
--   * 新增 `is_primary`，设定页用它选圆形主图。
-- 可选授权记录改为按设定保存：授权是「这个人同意公开自己设定的返图」，
-- 与单张照片无关。
--
-- 只新增前向迁移；历史迁移未修改。SQLite 无法直接删列与改 CHECK，
-- 因此 return_photos 采用与迁移 0017/0022/0023 相同的重建流程。
--
-- 既有返图按原 `work_id` 分组迁移为设定：名称与 slug 取自该作品，
-- 每组按创建时间最早的一张设为主图，授权记录从该组任意一张上提。
PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- 1. 先删除 return_photos 上的触发器，以及其他表上引用 return_photos 的触发器。
--    SQLite 在 ALTER TABLE RENAME 时重新解析整个 schema，任何仍引用
--    已被 DROP 的表的触发器都会让改名失败。
DROP TRIGGER IF EXISTS `return_photos_asset_role_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_asset_role_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_published_work_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_published_work_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `return_photos_published_identity_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `upload_sessions_owner_insert`;--> statement-breakpoint
-- 2. 设定表。`work_id` 可空且 ON DELETE SET NULL：作品被永久删除时
--    返图与私有原图都保留，只是失去作品入口。
CREATE TABLE `return_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`nickname` text,
	`work_id` text,
	`authorization_source` text,
	`authorization_confirmed_at` integer,
	`authorization_note` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "return_characters_slug_nonempty" CHECK(`slug` = trim(`slug`) AND length(`slug`) BETWEEN 1 AND 120),
	CONSTRAINT "return_characters_name_nonempty" CHECK(`name` = trim(`name`) AND length(`name`) BETWEEN 1 AND 100),
	CONSTRAINT "return_characters_nickname" CHECK(`nickname` IS NULL OR (`nickname` = trim(`nickname`) AND length(`nickname`) BETWEEN 1 AND 50)),
	CONSTRAINT "return_characters_version_positive" CHECK(`version` > 0),
	CONSTRAINT "return_characters_authorization_source" CHECK(`authorization_source` IS NULL OR `authorization_source` IN ('qq', 'email', 'other')),
	CONSTRAINT "return_characters_authorization_confirmed_at" CHECK(`authorization_confirmed_at` IS NULL OR `authorization_confirmed_at` > 0),
	CONSTRAINT "return_characters_authorization_note" CHECK(`authorization_note` IS NULL OR (`authorization_note` = trim(`authorization_note`) AND length(`authorization_note`) BETWEEN 1 AND 500))
);--> statement-breakpoint
CREATE UNIQUE INDEX `return_characters_slug_unique` ON `return_characters` (`slug`);--> statement-breakpoint
CREATE INDEX `return_characters_work_idx` ON `return_characters` (`work_id`);--> statement-breakpoint
-- 3. 由既有返图的关联作品生成设定。没有返图的作品不会得到空设定。
INSERT INTO `return_characters` (
	`id`, `slug`, `name`, `nickname`, `work_id`,
	`authorization_source`, `authorization_confirmed_at`, `authorization_note`,
	`version`, `created_at`, `updated_at`
)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4'
		|| substr(lower(hex(randomblob(2))), 2) || '-'
		|| substr('89ab', abs(random()) % 4 + 1, 1)
		|| substr(lower(hex(randomblob(2))), 2) || '-'
		|| lower(hex(randomblob(6))),
	work.`slug`,
	work.`character_name`,
	NULL,
	work.`id`,
	-- 授权记录按设定保存：从该组返图里取一条已填的即可，
	-- 迁移前每件作品的返图授权来自同一个人。
	(
		SELECT `authorization_source` FROM `return_photos`
		WHERE `work_id` = work.`id` AND `authorization_source` IS NOT NULL
		ORDER BY `created_at`, `id` LIMIT 1
	),
	(
		SELECT `authorization_confirmed_at` FROM `return_photos`
		WHERE `work_id` = work.`id` AND `authorization_confirmed_at` IS NOT NULL
		ORDER BY `created_at`, `id` LIMIT 1
	),
	(
		SELECT `authorization_note` FROM `return_photos`
		WHERE `work_id` = work.`id` AND `authorization_note` IS NOT NULL
		ORDER BY `created_at`, `id` LIMIT 1
	),
	1,
	(SELECT min(`created_at`) FROM `return_photos` WHERE `work_id` = work.`id`),
	(SELECT max(`updated_at`) FROM `return_photos` WHERE `work_id` = work.`id`)
FROM `works` AS work
WHERE EXISTS (
	SELECT 1 FROM `return_photos` WHERE `work_id` = work.`id`
);--> statement-breakpoint
-- 4. 重建 return_photos：归属设定，去掉 work_id、sort_order 与授权三列。
CREATE TABLE `__new_return_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`asset_id` text,
	`alt` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`publication_status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `return_characters`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "return_photos_alt_nonempty" CHECK(`alt` = trim(`alt`) AND length(`alt`) BETWEEN 1 AND 500),
	CONSTRAINT "return_photos_publication_status" CHECK(`publication_status` IN ('draft', 'published', 'unpublished')),
	CONSTRAINT "return_photos_version_positive" CHECK(`version` > 0),
	CONSTRAINT "return_photos_published_at" CHECK(`publication_status` != 'published' OR `published_at` IS NOT NULL),
	CONSTRAINT "return_photos_published_asset" CHECK(`publication_status` != 'published' OR `asset_id` IS NOT NULL),
	-- 主图必须是真的有图的那张：没有图片的草稿不能当设定封面。
	CONSTRAINT "return_photos_primary_asset" CHECK(`is_primary` = 0 OR `asset_id` IS NOT NULL)
);--> statement-breakpoint
INSERT INTO `__new_return_photos` (
	`id`, `character_id`, `asset_id`, `alt`, `is_primary`,
	`publication_status`, `version`, `published_at`, `created_at`, `updated_at`
)
SELECT
	photo.`id`,
	(
		SELECT `id` FROM `return_characters`
		WHERE `work_id` = photo.`work_id`
	),
	photo.`asset_id`,
	photo.`alt`,
	-- 每个设定里创建最早、且确实有图片的一张作为主图。
	CASE WHEN photo.`id` = (
		SELECT sibling.`id` FROM `return_photos` AS sibling
		WHERE sibling.`work_id` = photo.`work_id`
			AND sibling.`asset_id` IS NOT NULL
		ORDER BY sibling.`created_at`, sibling.`id` LIMIT 1
	) THEN 1 ELSE 0 END,
	photo.`publication_status`,
	photo.`version`,
	photo.`published_at`,
	photo.`created_at`,
	photo.`updated_at`
FROM `return_photos` AS photo;--> statement-breakpoint
DROP TABLE `return_photos`;--> statement-breakpoint
ALTER TABLE `__new_return_photos` RENAME TO `return_photos`;--> statement-breakpoint
CREATE UNIQUE INDEX `return_photos_asset_unique` ON `return_photos` (`asset_id`);--> statement-breakpoint
-- 一个设定最多一张主图；部分索引让 is_primary = 0 的行不参与唯一性。
CREATE UNIQUE INDEX `return_photos_primary_unique` ON `return_photos` (`character_id`) WHERE `is_primary` = 1;--> statement-breakpoint
CREATE INDEX `return_photos_character_idx` ON `return_photos` (`character_id`,`publication_status`);--> statement-breakpoint
CREATE INDEX `return_photos_public_idx` ON `return_photos` (`publication_status`,`id`);--> statement-breakpoint
-- 5. 恢复触发器。「已发布返图必须有已发布作品」不再恢复：
--    返图的公开可见性只取决于自己。
CREATE TRIGGER `return_photos_asset_role_insert`
BEFORE INSERT ON `return_photos`
WHEN NEW.`asset_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `assets`
  WHERE `id` = NEW.`asset_id`
    AND `role` = 'return_photo'
    AND `status` = 'READY'
)
BEGIN
  SELECT RAISE(ABORT, 'return photo requires a ready return_photo asset');
END;--> statement-breakpoint
CREATE TRIGGER `return_photos_asset_role_update`
BEFORE UPDATE OF `asset_id` ON `return_photos`
WHEN NEW.`asset_id` IS NOT OLD.`asset_id`
  AND NEW.`asset_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `assets`
    WHERE `id` = NEW.`asset_id`
      AND `role` = 'return_photo'
      AND `status` = 'READY'
  )
BEGIN
  SELECT RAISE(ABORT, 'return photo requires a ready return_photo asset');
END;--> statement-breakpoint
-- 已发布返图的身份关系（归属设定与图片）不可直接改写，必须先下架：
-- 否则公开衍生图会与记录指向的图片不一致。
CREATE TRIGGER `return_photos_published_identity_update`
BEFORE UPDATE OF `character_id`, `asset_id` ON `return_photos`
WHEN OLD.`publication_status` = 'published'
  AND (
    NEW.`character_id` != OLD.`character_id`
    OR NEW.`asset_id` IS NOT OLD.`asset_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'published return photo relations require unpublishing first');
END;--> statement-breakpoint
CREATE TRIGGER `upload_sessions_owner_insert`
BEFORE INSERT ON `upload_sessions`
WHEN
  (
    NEW.`owner_type` = 'work'
    AND NOT EXISTS (
      SELECT 1 FROM `works`
      WHERE `id` = NEW.`owner_id`
        AND `version` = NEW.`owner_version`
        AND (NEW.`media_role` != 'design_sheet' OR `purpose` = 'adoption')
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'home'
    AND NEW.`owner_version` != COALESCE(
      (SELECT `version` FROM `site_content` WHERE `id` = 'site'), 0
    )
  )
  OR (
    NEW.`owner_type` = 'site'
    AND NEW.`owner_id` = 'branding'
    AND NEW.`owner_version` != (
      SELECT `version` FROM `site_branding` WHERE `id` = 'site'
    )
  )
  OR (
    -- 返图上传的归属改为设定：一个设定可以有多张返图，
    -- 因此上传会话不再绑定单张照片记录。
    NEW.`owner_type` = 'return'
    AND NOT EXISTS (
      SELECT 1 FROM `return_characters`
      WHERE `id` = NEW.`owner_id` AND `version` = NEW.`owner_version`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'upload session owner is stale or incompatible');
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
