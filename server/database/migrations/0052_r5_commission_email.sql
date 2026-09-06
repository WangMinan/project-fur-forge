ALTER TABLE site_content ADD COLUMN commission_notification_recipients_json TEXT NOT NULL
  DEFAULT '["765678159@qq.com","3114559925@qq.com"]'
  CHECK (json_valid(commission_notification_recipients_json) AND json_type(commission_notification_recipients_json) = 'array');
--> statement-breakpoint
ALTER TABLE commission_submissions ADD COLUMN email_notification_policy TEXT NOT NULL DEFAULT 'legacy'
  CHECK (email_notification_policy IN ('legacy', 'enabled', 'disabled', 'unconfigured'));
--> statement-breakpoint
ALTER TABLE commission_submissions ADD COLUMN email_deletion_pending INTEGER NOT NULL DEFAULT 0
  CHECK (email_deletion_pending IN (0, 1));
--> statement-breakpoint
CREATE TABLE commission_email_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  submission_id TEXT NOT NULL REFERENCES commission_submissions(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  lease_token TEXT,
  lease_expires_at INTEGER,
  transmitting_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IN ('AUTH', 'REJECTED', 'TOO_LARGE', 'CONNECTION', 'ATTACHMENT', 'UNKNOWN')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER
);
--> statement-breakpoint
CREATE INDEX commission_email_due_idx ON commission_email_notifications(status, next_attempt_at);

--> statement-breakpoint
CREATE UNIQUE INDEX commission_email_recipient_unique ON commission_email_notifications(submission_id, recipient);
