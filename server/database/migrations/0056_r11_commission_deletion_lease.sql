ALTER TABLE commission_submissions ADD COLUMN deletion_lease_expires_at INTEGER
  CHECK (deletion_lease_expires_at IS NULL OR (email_deletion_pending = 1 AND deletion_lease_expires_at > 0));
