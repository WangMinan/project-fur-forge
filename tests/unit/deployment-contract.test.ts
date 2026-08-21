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
    const handbook = source(
      'agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md',
    )
    const activeLines = template
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')
    const templatePlaceholders = [...new Set(
      template.match(/@@[A-Z_]+@@/gu) ?? [],
    )].sort()
    const handbookReplacements = [...new Set(
      [...handbook.matchAll(/s\/(@@[A-Z_]+@@)\//gu)]
        .map(match => match[1]!),
    )].sort()

    expect(template).toContain('/etc/nginx/conf.d/ditedog.conf')
    expect(connectionMap).toContain('/etc/nginx/conf.d/00-connection-map.conf')
    expect(template).toContain('server 127.0.0.1:3000;')
    expect(template).toContain('server_name @@MEDIA_HOST@@;')
    expect(template).toContain('server_name @@PUBLIC_HOST@@ @@ADMIN_HOST@@;')
    expect(template).toContain('proxy_set_header X-Forwarded-Proto https;')
    expect(template).toContain('proxy_set_header X-Forwarded-Port  443;')
    expect(template).toContain('error_page 502 503 504 = @backend_unavailable;')
    expect(template.match(/return 421;/gu)).toHaveLength(2)
    expect(activeLines).toMatch(/listen 80 default_server;/u)
    expect(activeLines).not.toMatch(/listen\s+(?:\[::\]:)?443/u)
    expect(activeLines).not.toMatch(/ssl_certificate|acme\.sh|certbot/iu)
    expect(connectionMap).not.toMatch(/listen|server_name|ssl/iu)
    expect(handbookReplacements).toEqual(templatePlaceholders)
  })

  it('checks active ACME runtime state without blocking on inert host residue', () => {
    const verifier = source('deploy/host/verify-http-origin.sh')

    expect(verifier).toContain('nginx-listen-443-forbidden')
    expect(verifier).toContain('nginx-certificate-or-acme-config-forbidden')
    expect(verifier).toContain('systemctl list-timers --no-legend')
    expect(verifier).toContain('systemctl list-units --no-legend --type=service --state=active')
    expect(verifier).toContain('active-acme-certificate-process-forbidden')
    expect(verifier).not.toContain('list-timers --all')
    expect(verifier).not.toContain('list-units --all')
    expect(verifier).not.toContain('find /etc/letsencrypt')
    expect(verifier).not.toContain('host-certificate-files-forbidden')
  })

  it('inlines repository-local runtime modules in Nitro dev output', () => {
    const config = source('nuxt.config.ts')

    expect(config).toContain("new URL('./scripts/embedded-ffmpeg.mjs', import.meta.url)")
    expect(config).toContain("new URL('./scripts/esa-sdk.mjs', import.meta.url)")
    expect(config).toContain("new URL('./shared/utils/privacy-policy-readiness.mjs', import.meta.url)")
    expect(config).toContain("new URL('./scripts/oss-preflight-core.mjs', import.meta.url)")
    for (const runtime of [
      'embeddedFfmpegRuntime',
      'esaSdkRuntime',
      'ossPreflightCoreRuntime',
      'privacyPolicyReadinessRuntime',
    ]) {
      expect(config.slice(config.indexOf('externals:'), config.indexOf('handlers:')))
        .toContain(runtime)
    }
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
    const backupRetirement = source('server/utils/runner/r3-stage-a-backup-retirement.ts')
    const database = source('server/utils/database.ts')
    expect(dockerfile).toMatch(/^USER node$/mu)
    expect(dockerfile).not.toMatch(/apt-get install[^\n]*(?:nginx|certbot|cron)/iu)
    expect(dockerfile).toContain('scripts/esa-sdk.mjs')
    expect(dockerfile).toContain('new EsaClient(')
    expect(dockerfile).toContain('new PurgeCachesRequest(')
    expect(containerOps).toContain('confirmation: values.confirm')
    expect(containerOps).toContain("case 'upgrade-site-display-v2':")
    expect(containerOps).toContain("import('./site-display-upgrade-options')")
    expect(containerOps).toContain("case 'r3-stage-a-cleanup':")
    expect(containerOps).toContain("import('./r3-stage-a-cleanup')")
    expect(containerOps).toContain("case 'r3-stage-a-prune-backups':")
    expect(containerOps).toContain("import('./r3-stage-a-prune-backups')")
    expect(dockerfile).toContain('esbuild scripts/container-ops.ts')
    expect(backupRetirement).toContain("resolve('/app/backups')")
    expect(backupRetirement).toContain("resolve(dirname(databaseFile), 'backups')")
    expect(containerOps).not.toContain('return-photo-publication')
    expect(database).toContain("PRODUCTION_DATABASE_DIRECTORY = '/app/data'")
    expect(database).toContain('posix.dirname(databaseFile) !== PRODUCTION_DATABASE_DIRECTORY')
  })

  it('documents the one-time R3-A cleanup before Contract migration and backup retirement', () => {
    const deployment = source('docs/DEPLOYMENT.md')
    const stageA = deployment
      .split('### 4.1 需求3 R3-A 一次性永久退役\n')[1]
      ?.split('### 4.2 普通镜像更新\n')[0] ?? ''
    const cleanup = 'node ops/ops.mjs r3-stage-a-cleanup --environment-prefix prod/'
    const migrate = 'node ops/ops.mjs migrate'
    const cleanBackup = 'node ops/ops.mjs backup --output "$CLEAN_BACKUP"'
    const prune = 'node ops/ops.mjs r3-stage-a-prune-backups'

    expect(deployment).toContain('--confirm "DELETE R3-A RETIRED MEDIA"')
    expect(deployment).toContain('--confirm "DELETE R3-A OLD APP BACKUPS"')
    expect(stageA.indexOf(cleanup)).toBeLessThan(stageA.indexOf(migrate))
    expect(stageA.indexOf(migrate)).toBeLessThan(stageA.indexOf(cleanBackup))
    expect(stageA.indexOf(cleanBackup)).toBeLessThan(stageA.indexOf(prune))
  })

  it('keeps R3-A importable commands free of direct-execution side effects', () => {
    const cleanup = source('scripts/r3-stage-a-cleanup.ts')
    const cleanupCli = source('scripts/r3-stage-a-cleanup-cli.ts')
    const prune = source('scripts/r3-stage-a-prune-backups.ts')
    const pruneCli = source('scripts/r3-stage-a-prune-backups-cli.ts')
    const packageJson = source('package.json')
    const quality = source('.github/workflows/quality.yml')

    for (const importableModule of [cleanup, prune]) {
      expect(importableModule).not.toContain('import.meta.url')
      expect(importableModule).not.toContain('process.stdout.write')
      expect(importableModule).not.toContain('process.exitCode')
    }
    expect(cleanupCli).toContain('runR3StageACleanupCli()')
    expect(pruneCli).toContain('runR3StageABackupPruneCli()')
    expect(packageJson).toContain('tsx scripts/r3-stage-a-cleanup-cli.ts')
    expect(packageJson).toContain('tsx scripts/r3-stage-a-prune-backups-cli.ts')
    expect(quality).toContain("! grep -Fq 'Unexpected argument'")
  })

  it('ships one v2 upgrade parser through pnpm and the frozen deployment image', () => {
    const packageJson = source('package.json')
    const localUpgrade = source('scripts/upgrade-site-display-v2.ts')
    const containerOps = source('scripts/container-ops.ts')
    const deployment = source('docs/DEPLOYMENT.md')
    const handbook = source(
      'agent_docs/需求1-兽装工作室主页/implementation/PRODUCTION-LAUNCH-HANDBOOK.md',
    )

    expect(packageJson).toContain('"media:upgrade-site-display-v2"')
    expect(localUpgrade).toContain("from './site-display-upgrade-options'")
    expect(containerOps).toContain("import('./site-display-upgrade-options')")
    for (const document of [deployment, handbook]) {
      expect(document).toContain('node ops/ops.mjs upgrade-site-display-v2 --scope all')
      expect(document).toContain('--scope all --no-dry-run')
    }
  })

  it('keeps publication manual and exercises the target deployment shape in CI', () => {
    const quality = source('.github/workflows/quality.yml')
    const release = source('.github/workflows/release-image.yml')
    const dependabot = source('.github/dependabot.yml')
    expect(release).toContain('workflow_dispatch:')
    expect(release).toContain('PUBLISH_GATE_E_IMAGE')
    expect(release).toContain('if [[ "${GITHUB_REF}" != "refs/heads/main" ]]')
    expect(release).toContain('--arg commit "${GITHUB_SHA}"')
    expect(release).toContain('"${REQUESTED_TAG}" == "latest"')
    expect(release).toContain('type=raw,value=latest')
    expect(release).toContain('imageRef: $image_ref')
    expect(release).toContain('APP_IMAGE_REF=${image_ref}')
    expect(release).not.toContain('frozen_sha:')
    expect(release).not.toContain('REQUESTED_SHA')
    expect(release).toContain('steps.build.outputs.digest')
    expect(release).toContain('release: true')
    expect(release.indexOf('authorize:')).toBeLessThan(release.indexOf('quality:'))
    expect(release).toContain('DOCKER_BUILD_RECORD_UPLOAD: false')
    expect(release).not.toMatch(/^\s+push:$/mu)
    expect(release).not.toContain('push:\n    tags:')
    expect(quality).toContain("paths-ignore:\n      - '**/*.md'")
    expect(quality).toContain('run: pnpm check:fast')
    expect(quality).toContain('run: pnpm test:release')
    expect(quality).not.toContain('release-tests:')
    expect(quality).not.toContain('check-artifacts')
    expect(quality).toContain('Upload failed release-test artifacts')
    expect(quality).toContain('retention-days: 3')
    expect(quality).toContain('DOCKER_BUILD_RECORD_UPLOAD: false')
    expect(quality).toContain('scope=release-image')
    expect(quality).not.toContain('run: pnpm test:e2e')
    expect(quality).toContain('node ops/ops.mjs restore-verify')
    expect(quality).toContain('node ops/ops.mjs recover-operations')
    expect(quality).toContain('node ops/ops.mjs reset-admin-password')
    expect(quality).toContain('--confirm RESET_SINGLE_ADMIN_PASSWORD')
    expect(quality).toContain('ci-init@password-2026')
    expect(quality).toContain('ci-reset@password-2026')
    expect(quality).toContain('project-fur-forge:rollback-candidate')
    expect(quality).toContain('test "${old_image}" != "${candidate_image}"')
    expect(quality).toContain('nginx:1.30.4')
    expect(quality).toContain('docker exec fur-forge-nginx-test nginx -s reload')
    expect(quality).toContain("'Origin: https://admin.test.invalid'")
    expect(quality).toContain('http://127.0.0.1/api/auth/logout')
    expect(dependabot.match(/interval: monthly/gu)).toHaveLength(3)
    expect(dependabot.match(/open-pull-requests-limit: 1/gu)).toHaveLength(3)
    expect(dependabot.match(/rebase-strategy: disabled/gu)).toHaveLength(3)
  })
})
