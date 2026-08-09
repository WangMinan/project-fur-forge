import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
}

function serviceNames(compose: string) {
  const section = compose.split('\nservices:\n')[1]?.split('\nvolumes:\n')[0] ?? ''
  return [...section.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gmu)].map(match => match[1])
}

describe('T52-E6 production deployment contract', () => {
  it('keeps Compose app-only, immutable, loopback-bound, and persistent', () => {
    const compose = source('docker-compose.yaml')
    expect(serviceNames(compose)).toEqual(['app'])
    expect(compose).toContain('image: ${APP_IMAGE_REF:?')
    expect(compose).toContain('- "127.0.0.1:3000:3000"')
    expect(compose).toContain('DATABASE_FILE: ${DATABASE_FILE:?')
    expect(compose).toContain('TRUSTED_PROXY_CIDRS: ${TRUSTED_PROXY_CIDRS:?')
    expect(compose).toContain('PREFLIGHT_EVIDENCE_DIR: /app/backups/production-preflight')
    expect(compose).toContain('- app-data:/app/data')
    expect(compose).toContain('- app-backups:/app/backups')
    expect(compose).toContain('read_only: true')
    expect(compose).toContain('restart: unless-stopped')
    expect(compose).toContain("headers:{host}")
    expect(compose).toContain("path:'/api/health/ready'")
    expect(compose).toContain('subnet: 172.30.250.0/24')
    expect(compose).not.toMatch(/^\s+build:/mu)
    expect(compose).not.toMatch(/^\s+(nginx|migrate):$/mu)
    expect(compose).not.toContain('443:443')
    expect(compose).not.toContain('TLS_CERT')
  })

  it('matches the real systemd Nginx HTTP-only file layout', () => {
    const template = source('deploy/nginx/app.conf.template')
    const connectionMap = source('deploy/nginx/00-connection-map.conf')
    const activeLines = template
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')

    expect(template).toContain('/etc/nginx/conf.d/ditedog.conf')
    expect(connectionMap).toContain('/etc/nginx/conf.d/00-connection-map.conf')
    expect(template).toContain('server 127.0.0.1:3000;')
    expect(template).toContain('server_name public-media.ditedog.com;')
    expect(template).toContain('server_name @@PUBLIC_HOST@@ @@ADMIN_HOST@@;')
    expect(template).toContain('proxy_set_header X-Forwarded-Proto https;')
    expect(template).toContain('proxy_set_header X-Forwarded-Port  443;')
    expect(template).toContain('error_page 502 503 504 = @backend_unavailable;')
    expect(template.match(/return 421;/gu)).toHaveLength(2)
    expect(activeLines).toMatch(/listen 80 default_server;/u)
    expect(activeLines).not.toMatch(/listen\s+(?:\[::\]:)?443/u)
    expect(activeLines).not.toMatch(/ssl_certificate|acme\.sh|certbot/iu)
    expect(connectionMap).not.toMatch(/listen|server_name|ssl/iu)
  })

  it('keeps the production example intentionally blocked until real values exist', () => {
    const environment = source('.env.compose.example')
    expect(environment).toMatch(/^APP_IMAGE_REF=.*@sha256:0{64}$/mu)
    expect(environment).toContain('DATABASE_FILE=/app/data/studio.db')
    expect(environment).toContain('TRUSTED_PROXY_CIDRS=172.30.250.1/32,replace-me-with-current-esa-cidrs')
    expect(environment).not.toMatch(/^TLS_/mu)
    expect(environment).not.toMatch(/^APP_IMAGE_TAG=/mu)
  })

  it('runs the published image as the non-root Node user', () => {
    const dockerfile = source('Dockerfile')
    const containerOps = source('scripts/container-ops.ts')
    expect(dockerfile).toMatch(/^USER node$/mu)
    expect(dockerfile).not.toMatch(/apt-get install[^\n]*(?:nginx|certbot|cron)/iu)
    expect(containerOps).toContain("import('../server/utils/runner/return-photo-publication')")
  })

  it('keeps publication manual and exercises the target deployment shape in CI', () => {
    const quality = source('.github/workflows/quality.yml')
    const release = source('.github/workflows/release-image.yml')
    expect(release).toContain('workflow_dispatch:')
    expect(release).toContain('PUBLISH_GATE_E_IMAGE')
    expect(release).toContain('"${REQUESTED_SHA}" != "${GITHUB_SHA}"')
    expect(release).toContain('steps.build.outputs.digest')
    expect(release).not.toMatch(/^\s+push:$/mu)
    expect(release).not.toContain('push:\n    tags:')
    expect(quality).toContain('test "$(docker compose -f docker-compose.yaml config --services)" = "app"')
    expect(quality).toContain('node ops/ops.mjs restore-verify')
    expect(quality).toContain('node ops/ops.mjs recover-operations')
    expect(quality).toContain('project-fur-forge:rollback-candidate')
    expect(quality).toContain('test "${old_image}" != "${candidate_image}"')
    expect(quality).toContain('nginx:1.30.4')
    expect(quality).toContain('docker exec fur-forge-nginx-test nginx -s reload')
    expect(quality).toContain("'Origin: https://admin.test.invalid'")
    expect(quality).toContain('http://127.0.0.1/api/auth/logout')
  })
})
