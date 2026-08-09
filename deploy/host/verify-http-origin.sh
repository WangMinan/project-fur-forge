#!/usr/bin/env bash
set -uo pipefail

public_host=""
admin_host=""
reload_requested=0
failures=0

usage() {
  echo "usage: $0 --public-host HOST --admin-host HOST [--reload]" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-host)
      public_host="${2:-}"
      shift 2
      ;;
    --admin-host)
      admin_host="${2:-}"
      shift 2
      ;;
    --reload)
      reload_requested=1
      shift
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

valid_host() {
  [[ "$1" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] \
    && [[ "$1" == *.* ]] \
    && [[ "$1" != *".."* ]]
}

if ! valid_host "$public_host" || ! valid_host "$admin_host" || [[ "$public_host" == "$admin_host" ]]; then
  usage
  exit 2
fi

pass() {
  printf 'PASS\t%s\n' "$1"
}

fail() {
  printf 'FAIL\t%s\n' "$1"
  failures=$((failures + 1))
}

check_command() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "command-$1"
  else
    fail "command-$1-missing"
  fi
}

printf 'INFO\tcaptured-at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'INFO\tpublic-host=%s\n' "$public_host"
printf 'INFO\tadmin-host=%s\n' "$admin_host"

for required_command in nginx systemctl ss curl pgrep find; do
  check_command "$required_command"
done
if [[ $failures -gt 0 ]]; then
  exit 1
fi

if nginx -t >/dev/null 2>&1; then
  pass "nginx-config-test"
else
  fail "nginx-config-test"
fi

nginx_config="$(nginx -T 2>&1)"
if grep -Eq '(^|[[:space:]])listen[[:space:]]+([^;[:space:]]*:)?80([[:space:]]|;)' <<<"$nginx_config"; then
  pass "nginx-listen-80-configured"
else
  fail "nginx-listen-80-configured"
fi
if grep -Eq '(^|[[:space:]])listen[[:space:]]+([^;[:space:]]*:)?443([[:space:]]|;)' <<<"$nginx_config"; then
  fail "nginx-listen-443-forbidden"
else
  pass "nginx-listen-443-absent"
fi
if grep -Eiq 'ssl_certificate|ssl_certificate_key|acme\.sh|certbot' <<<"$nginx_config"; then
  fail "nginx-certificate-or-acme-config-forbidden"
else
  pass "nginx-certificate-and-acme-config-absent"
fi
for exact_host in "$public_host" "$admin_host"; do
  if grep -Fq "$exact_host" <<<"$nginx_config"; then
    pass "nginx-exact-host-$exact_host"
  else
    fail "nginx-exact-host-$exact_host"
  fi
done

listens="$(ss -lntH)"
if grep -Eq '[[:space:]](0\.0\.0\.0|\*|\[::\]):80[[:space:]]' <<<"$listens"; then
  pass "host-listen-80"
else
  fail "host-listen-80"
fi
if grep -Eq '[[:space:]]([^[:space:]]*:)?443[[:space:]]' <<<"$listens"; then
  fail "host-listen-443-forbidden"
else
  pass "host-listen-443-absent"
fi
if grep -Eq '[[:space:]]127\.0\.0\.1:3000[[:space:]]' <<<"$listens" \
  && ! grep -Eq '[[:space:]](0\.0\.0\.0|\*|\[::\]):3000[[:space:]]' <<<"$listens"; then
  pass "app-loopback-3000-only"
else
  fail "app-loopback-3000-only"
fi

timer_text="$(systemctl list-timers --all --no-legend 2>/dev/null || true)"
service_text="$(systemctl list-units --all --no-legend --type=service 2>/dev/null || true)"
if grep -Eiq 'acme|certbot|letsencrypt' <<<"${timer_text}${service_text}"; then
  fail "acme-certificate-scheduler-forbidden"
else
  pass "acme-certificate-scheduler-absent"
fi
if pgrep -af 'acme\.sh|certbot|letsencrypt' >/dev/null 2>&1; then
  fail "acme-certificate-process-forbidden"
else
  pass "acme-certificate-process-absent"
fi
certificate_file_count="$(
  {
    find /etc/letsencrypt /etc/nginx/certs /etc/nginx/ssl /root/.acme.sh -type f 2>/dev/null
    find /home -path '*/.acme.sh/*' -type f 2>/dev/null
  } | wc -l
)"
if [[ "$certificate_file_count" == "0" ]]; then
  pass "host-certificate-files-absent"
else
  fail "host-certificate-files-forbidden"
fi

ready_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:3000/api/health/ready || true)"
if [[ "$ready_status" == "200" ]]; then
  pass "app-ready"
else
  fail "app-ready"
fi
for exact_host in "$public_host" "$admin_host"; do
  origin_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 --header "Host: $exact_host" http://127.0.0.1/ || true)"
  if [[ "$origin_status" =~ ^[23][0-9][0-9]$ ]]; then
    pass "http-origin-$exact_host"
  else
    fail "http-origin-$exact_host"
  fi
done

if [[ $reload_requested -eq 1 ]]; then
  if [[ $failures -eq 0 ]] && nginx -t >/dev/null 2>&1 && systemctl reload nginx; then
    pass "nginx-safe-reload"
    if nginx -t >/dev/null 2>&1; then
      pass "nginx-config-test-after-reload"
    else
      fail "nginx-config-test-after-reload"
    fi
  else
    fail "nginx-safe-reload"
  fi
else
  printf 'SKIP\tnginx-safe-reload-requires-explicit---reload\n'
fi

if [[ $failures -gt 0 ]]; then
  printf 'RESULT\tFAIL\tfailures=%s\n' "$failures"
  exit 1
fi
printf 'RESULT\tPASS\n'
