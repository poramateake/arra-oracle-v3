#!/usr/bin/env bash
set -Eeuo pipefail

repo="${ARRA_REPO_ROOT:-$(pwd)}"
env_file="${ARRA_PRIVATE_ENV_FILE:-/etc/arra-oracle/private.env}"
adapter_env="${ARRA_OPENAI_ENV_FILE:-/etc/arra-oracle/openai.env}"
expected_commit="${ARRA_PINNED_COMMIT:-}"
[[ -d "$repo/.git" ]] || { echo "repo metadata missing: $repo" >&2; exit 2; }
[[ -n "$expected_commit" ]] || { echo "ARRA_PINNED_COMMIT is required" >&2; exit 2; }
actual_commit="$(git -C "$repo" rev-parse HEAD)"
[[ "$actual_commit" == "$expected_commit" ]] || { echo "commit mismatch: expected pinned alpha commit" >&2; exit 1; }
if [[ "${ARRA_ALLOW_DIRTY:-0}" != "1" ]] && [[ -n "$(git -C "$repo" status --porcelain)" ]]; then
  echo "repo worktree is dirty; deploy only a reviewed committed revision" >&2
  exit 1
fi
[[ -s "$env_file" ]] || { echo "protected runtime env missing: $env_file" >&2; exit 2; }
[[ -s "$adapter_env" ]] || { echo "protected adapter env missing: $adapter_env" >&2; exit 2; }

mode_of() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }
[[ "$(mode_of "$env_file")" == "600" ]] || { echo "protected runtime env must be mode 600" >&2; exit 1; }
[[ "$(mode_of "$adapter_env")" == "600" ]] || { echo "protected adapter env must be mode 600" >&2; exit 1; }
value_of() { sed -n "s/^$1=//p" "$2" | head -n 1; }
require_value() {
  local key="$1" file="$2" value
  value="$(value_of "$key" "$file")"
  [[ -n "$value" && "$value" != *[[:space:]]* ]] || { echo "$key missing from protected env" >&2; exit 1; }
  case "$value" in enter-on-*|existing-mint-*|REPLACE_ME|CHANGE_ME) echo "$key is still a placeholder" >&2; exit 1 ;; esac
}
if ! grep -Eq '^ARRA_API_TOKEN=[^[:space:]]' "$env_file" && ! grep -Eq '^ORACLE_MCP_HTTP_TOKEN=[^[:space:]]' "$env_file"; then
  echo "protected runtime env has no bearer/MCP token" >&2; exit 1
fi
require_value ARRA_API_TOKEN "$env_file"
require_value OPENAI_API_KEY "$env_file"
require_value OPENAI_CHAT_MODEL "$env_file"
require_value OPENAI_API_KEY "$adapter_env"
require_value OPENAI_CHAT_MODEL "$adapter_env"
if grep -Eq '^(TUNNEL_URL|PUBLIC_URL|ORACLE_FEDERATION_TOKEN)=[^[:space:]]' "$env_file" || grep -Eq '^(TUNNEL_URL|PUBLIC_URL|ORACLE_FEDERATION_TOKEN)=[^[:space:]]' "$adapter_env"; then
  echo "public tunnel/federation secret is forbidden in private deployment" >&2
  exit 1
fi
if grep -Eq '^(ARRA_API_TOKEN|ARRA_API_KEY|ORACLE_MCP_HTTP_TOKEN)=' "$adapter_env"; then
  echo "adapter env must not contain Mint authority credentials" >&2
  exit 1
fi
if grep -Eq '^OPENAI_CHAT_URL=' "$adapter_env" && ! grep -Eq '^OPENAI_CHAT_URL=https://api\.openai\.com/v1/chat/completions$' "$adapter_env"; then
  echo "adapter env contains an unapproved OpenAI endpoint" >&2
  exit 1
fi
if grep -Eq '^OPENAI_API_BASE=' "$adapter_env" && ! grep -Eq '^OPENAI_API_BASE=https://api\.openai\.com/v1$' "$adapter_env"; then
  echo "adapter env contains an unapproved OpenAI API base" >&2
  exit 1
fi
if [[ "${ARRA_RUN_PROVIDER_PREFLIGHT:-0}" == "1" ]]; then
  "$repo/deploy/private/arra-full-stack/openai-model-preflight.sh"
fi
if pgrep -f '[a]rra.*server|dist/server\.js' >/dev/null 2>&1; then
  echo "possible existing Arra writer detected; stop it before staged cutover" >&2
  exit 1
fi
echo "preflight ok: commit pinned, protected auth/provider env present, no public exposure markers, no writer detected"
