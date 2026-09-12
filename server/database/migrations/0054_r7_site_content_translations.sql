ALTER TABLE site_content ADD COLUMN home_content_version INTEGER NOT NULL DEFAULT 1 CHECK(home_content_version > 0);
--> statement-breakpoint
-- R7: Chinese content stays in site_content; translations are independent records.
CREATE TABLE site_content_translations (
  locale TEXT NOT NULL CHECK(length(locale) BETWEEN 2 AND 35 AND locale <> 'zh-CN'),
  section TEXT NOT NULL CHECK(section IN ('home', 'commission', 'about', 'status')),
  fields_json TEXT NOT NULL CHECK(json_valid(fields_json) AND json_type(fields_json) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(locale, section)
);
--> statement-breakpoint
INSERT INTO site_content_translations VALUES ('en', 'home', '{"tagline": "Not just dogs. Always hand-carved foam heads."}', 1, 1789171200000);
--> statement-breakpoint
INSERT INTO site_content_translations VALUES ('en', 'commission', '{"intro": "Please contact us on X to discuss your character and commission.", "estimateNote": "Please share a clear character reference when contacting us on X. We will review the design and discuss the scope and schedule with you.", "emailAction": "Email is also available for general enquiries. Please use X for commission enquiries outside mainland China."}', 1, 1789171200000);
--> statement-breakpoint
INSERT INTO site_content_translations VALUES ('en', 'about', '{"studioFacts": "DITE DOG makes fullsuits and partial fursuits — not just dogs! All our fursuit heads are built with hand-carved foam. Explore our characters or contact us on X about a custom commission.", "makingScope": "We currently make fullsuits and partials. Fullsuits include a head, body, paws and tail; partials include a head and paws. Construction, materials and details are discussed on X before we confirm a commission."}', 1, 1789171200000);
--> statement-breakpoint
INSERT INTO site_content_translations
SELECT 'en', 'status', json_object('label', CASE tone WHEN 'open' THEN 'Commissions open' ELSE 'Commissions closed' END), 1, 1789171200000
FROM business_statuses WHERE kind = 'commission';
