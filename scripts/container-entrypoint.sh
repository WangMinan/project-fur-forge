#!/bin/sh
set -eu

command="${1:-serve}"
shift || true

case "$command" in
  serve)
    exec node .output/server/index.mjs "$@"
    ;;
  migrate)
    exec pnpm db:migrate -- "$@"
    ;;
  init-admin)
    exec pnpm auth:init -- "$@"
    ;;
  reset-password)
    exec pnpm auth:reset-password -- "$@"
    ;;
  backup)
    exec pnpm db:backup -- "$@"
    ;;
  restore)
    exec pnpm db:restore -- "$@"
    ;;
  preflight-oss)
    exec pnpm preflight:oss -- "$@"
    ;;
  preflight-watermark)
    exec pnpm preflight:watermark -- "$@"
    ;;
  verify-production)
    exec pnpm verify:production -- "$@"
    ;;
  upload-cleanup)
    exec pnpm upload:cleanup -- "$@"
    ;;
  *)
    echo "Unknown container command: $command" >&2
    exit 64
    ;;
esac
