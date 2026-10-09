ALTER TABLE `works` ADD COLUMN `artist` text
  CONSTRAINT `works_artist` CHECK (
    `artist` IS NULL OR (
      `purpose` = 'adoption' AND `artist` = trim(`artist`)
      AND length(`artist`) BETWEEN 1 AND 100
    )
  );
