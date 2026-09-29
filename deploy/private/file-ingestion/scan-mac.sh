#!/bin/sh
set -eu
exec /usr/bin/python3 /Users/poramateake/.codex/lib/arra-files/collector.py \
  --root "${ARRA_FILES_ROOT:-/System/Volumes/Data}" \
  --device mac \
  --volume 522BAE6B-91FE-4304-A49E-222D41969845 \
  --state /Users/poramateake/.codex/arra-files-state \
  --limit "${ARRA_FILES_SCAN_LIMIT:-25}" \
  --transport-key /Users/poramateake/.ssh/id_ed25519_arra_files_mac \
  --transport-target poramateake@100.109.242.66 \
  --known-hosts /Users/poramateake/.ssh/known_hosts
