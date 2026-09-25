# Private full-stack Arra deployment

## Goal

Deploy the official Arra surfaces privately with Mint as the authority, MacBook
as the Codex control plane, and Acer as the restricted five-tool bridge. Add
OpenAI `text-embedding-3-small` plus SQLite-vec, a local cited-answer adapter,
curated corpus ingestion, suggestion-only workers, encrypted backup/restore,
staged cutover, and cross-device acceptance evidence.

## Constraints

- No public Cloudflare/Vercel deployment, arbitrary personal-folder import,
  broad session scanning, or separate swarm runtime.
- Preserve existing Mint SSH, bearer/MCP, Hermes, Codex, and Tailscale auth.
- Never log or commit secrets; OpenAI key remains in a Codex-owned mode-600
  file and is streamed only into Mint's protected runtime environment.
- Mint Arra and the adapter bind loopback only. Acer keeps its existing
  forced-command five-tool bridge.
- Workers detect and queue suggestions only; approval remains human-controlled.
- Work from the pinned `alpha` commit; repository contract requires a feature
  branch and PR targeting `alpha` (not direct shared-branch push).

## QA rulings applied

1. Entity backfill must have an explicit dry-run/suggestion-only mode with a
   regression proving documents, links, and vectors do not mutate.
2. First-party plugin discovery must be exclusive/canonical, exact-name,
   fail-closed, and reject shadowing, symlinks, missing plugins, and lifecycle
   failures across HTTP/MCP/CLI.
3. Backup/restore must include encrypted data/config/manifests, preserve the
   last good snapshot, and boot an isolated restored service with vectors.
4. Auth requires negative tests for absent/wrong tokens and an explicit route
   policy; production startup must reject missing protected credentials.
5. “Private” means no public hosting; approved curated text/query may reach the
   explicitly pinned OpenAI provider. No implicit provider fallback.
6. Cutover starts with isolated workers disabled, app-consistent snapshots,
   rollback trigger/deadline, and data rollback—not only configuration.

## Work items

1. Add deployment bundle: manifest, protected environment template, adapter,
   health/acceptance gate, encrypted backup/restore, runbook, rollback notes.
2. Add adapter tests first; implement bounded structured OpenAI calls and
   fail-closed extractive/NOOP behavior.
3. Add worker dry-run safety, plugin isolation, and auth negative-test gates.
4. Add deterministic curated corpus checks and route/MCP/client matrices.
5. Run local typecheck/scoped tests/build; then stage and deploy on Mint only
   after preflight confirms auth/config compatibility and no concurrent writer.
6. Run isolated restore and cross-device gates; record evidence; remove only
   temporary completion cron and retain normal backup/health monitoring.
7. Commit deployment artifacts/docs/evidence, push feature branch, open PR to
   `alpha`; do not self-merge.
