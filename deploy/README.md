# Container deployment

The same Node 24 image provides `serve`, `migrate`, `init-admin`, `backup`,
`restore`, preflight, and upload-cleanup commands. `compose.yaml` runs migrations
before the application and routes the public/admin hosts through Nginx.

1. Copy `deploy/runtime.production.example` to `.env.production` and fill every
   production value. Generate `SESSION_SECRET` with a cryptographically secure
   random source.
2. Build on the trusted build machine:
   `docker build -t project-fur-forge:phase-c1 .`
3. Start the HTTP acceptance stack:
   `docker compose up -d --wait`.
4. Initialize the single administrator once:
   `docker compose run --rm -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='<secret>' app init-admin`.
5. Production TLS uses real `fullchain.pem` and `privkey.pem` under the selected
   certificate directory:
   `docker compose -f compose.yaml -f compose.production.yaml up -d --wait`.

Backups are written to `/app/backups`, which is a separate named volume. Never
restore over the active database; restore to a new path, verify it, stop the
application, then switch files according to the runbook.
