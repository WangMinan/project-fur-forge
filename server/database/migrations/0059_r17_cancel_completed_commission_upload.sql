DROP TRIGGER `commission_upload_sessions_status_transition`;
--> statement-breakpoint
CREATE TRIGGER `commission_upload_sessions_status_transition`
BEFORE UPDATE OF `status` ON `commission_upload_sessions`
WHEN NEW.`status` != OLD.`status` AND NOT (
  (OLD.`status` = 'AWAITING_UPLOAD' AND NEW.`status` IN ('VALIDATING', 'CANCELLED', 'EXPIRED'))
  OR (OLD.`status` = 'VALIDATING' AND NEW.`status` IN ('COMPLETED', 'FAILED'))
  OR (OLD.`status` = 'COMPLETED' AND NEW.`status` IN ('CONSUMED', 'CANCELLED'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid commission upload status transition');
END;
