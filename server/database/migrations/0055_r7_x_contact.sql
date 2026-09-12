ALTER TABLE site_content ADD COLUMN x_contact_url TEXT NOT NULL DEFAULT 'https://x.com/jece9925' CHECK(length(x_contact_url) BETWEEN 1 AND 200);
