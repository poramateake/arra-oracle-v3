# SDD ledger — plan: docs/superpowers/plans/2026-09-25-private-full-stack-arra-deployment.md

## Pre-flight

- Base: `aaedb8d66d2afd25e6a0326bc76dc8bd29da2e79` (`origin/alpha`).
- Workspace: isolated clone `/Users/poramateake/Documents/arra-oracle/arra-oracle-v3-impl`.
- Branch: `feat/private-full-stack-arra-deployment`.
- Plan approved by user in-session; Astra-light multi-agent QA completed before implementation.
- Interface: adapter → ask/consolidation clients — preserve `{instruction, question, sources}` input and `{answer, citations, noEvidence}` / `SUPERSEDE|NOOP` outputs; test against existing callers.
- Interface: bundle env/manifest → Mint rollout — names and route policy must match repository env loaders before remote changes.
- Interface: backup bundle → restore gate — include DB/vector/source/config manifest and boot the restored service, not file-only verification.
- Ruling: repository AGENTS contract overrides the plan's “push to alpha” wording — use feature branch + PR targeting `alpha`; no direct shared-branch push or self-merge. Cost if wrong: integration waits for review; safety benefit: preserves working trunk.
- Ruling: no OpenAI key is available to this session; implement/test provider plumbing and fail-closed behavior locally, then stop at the explicit key/admin gate rather than inventing credentials. Cost if wrong: production semantic/LLM gate remains pending.
- Ruling: Hermes/Grok is the primary inference provider; Codex is an optional fallback through a local, read-only `codex exec` bridge because the installed CLI exposes non-interactive JSON output but no stable OpenAI-compatible HTTP inference endpoint. Cost if wrong: Codex fallback remains unavailable until its bridge is explicitly enabled and its existing login is valid.

## Tasks

- Task 1: deployment bundle skeleton, manifest, runbook, protected env template.
- Task 2: local LLM adapter (tests first), provider/model allowlist, fail-closed behavior.
- Task 3: worker/plugin/auth safety gates with tests.
- Task 4: encrypted backup/restore and deterministic corpus/health gate scripts.
- Task 5: local build/test/review; then remote Mint staged deployment and evidence if gates permit.
- Task 6: cross-device acceptance evidence, temporary cron cleanup, commit/PR.

## Evidence — 2026-09-25

- Astra-light QA pass 1 and pass 2 completed. Findings were applied before
  claiming readiness: private image/runtime assets, quiesced encrypted backup,
  strict plugin/corpus boundaries, auth negatives, loopback Compose ports, and
  bounded fail-closed adapter behavior.
- Additional hardening: `/mcp` is exempted from the global API-key middleware
  because streamable MCP has its own bearer verifier; private startup now
  requires a loopback `ORACLE_BIND_HOST`; staging has a distinct loopback port
  and named data volume; strict plugin entry symlinks are rejected lexically.
- Restore proof now checks archive commit against the pinned checkout,
  reconstructs allowlisted corpus roots, runs with `env -i`, uses separate
  random HTTP/MCP tokens, verifies authenticated MCP initialize, loopback
  binding, and a restart. Default local proof is explicitly FTS-only; the
  `--require-vector` gate requires a mode-600 OpenAI env and semantic query.
- Final local evidence: full unit suite `672 pass, 0 fail` (186 files), full
  integration `38 pass, 13 skip, 0 fail` (51 tests/6 files), frontend build,
  typecheck, shell syntax, and `git diff --check` passed. Final deployment
  suite passed `52 pass, 0 fail`; corpus manifest/snapshot and Compose staging
  config passed with 90 curated files. Fresh encrypted-backup restore proof
  passed commit/corpus/FTS/source-hash/FTS-content-hash/MCP JSON-RPC/
  loopback/restart checks; semantic restore was not run without a provider key.
- Final Astra-light multi-agent source QA: PASS. It specifically rechecked
  strict JSON-RPC/SSE MCP restore validation, absolute-path corpus rejection,
  source coverage, private auth separation, and loopback-only publication.
- Remote blocker unchanged: Mint Docker/service mutation needs one interactive
  administrator authorization, and semantic/LLM gates need the user to enter
  the OpenAI key locally into the protected file. Final read-only SSH check:
  `poramateake-Macmini`, alpha `aaedb8d6`, DB connected, existing FTS service
  degraded only because vector section is disabled, and non-interactive Docker
  authorization is unavailable. Current unauthenticated API behavior was
  confirmed (`/api/stats` and `/api/search` return 200); `/mcp` remains bearer
  protected. Reviewed commit `5807969b` was copied into isolated Mint staging
  clone `/home/poramateake/Documents/arra-oracle/staging/arra-5807969b`; the
  production alpha checkout/container was not changed.

- Provider revision — 2026-09-25: OpenAI chat inference is not a deployment
  dependency. The private adapter now accepts an ordered provider chain:
  Hermes/Grok (`127.0.0.1:8642`) → local Codex CLI bridge
  (`127.0.0.1:47781`) → fail-closed extractive/NOOP behavior. Hermes and Codex
  credentials are separate mode-600 secrets; Codex uses the existing Mint
  ChatGPT OAuth login through read-only `codex exec`, never Arra/MCP tools.
  FTS-only remains the default for embeddings; semantic vectors still require
  a separately approved embedding provider.
- Fresh provider evidence: `bun test tests/deploy/private` — 18 pass, 0 fail;
  config/provider/manifest targeted suite — 33 pass, 0 fail; Codex bridge
  unittest — 3 pass, 0 fail; `bunx tsc --noEmit`, shell syntax, Python compile,
  and `git diff --check` passed. Full suite — 672 pass, 0 fail; integration —
  38 pass, 13 skip, 0 fail; frontend build passed with only the existing chunk
  size warning.

- Mint provider rollout — 2026-09-25: strict SSH preflight and root-admin path
  completed without changing the original Arra checkout. Hermes env backup was
  created before enabling/adjusting the loopback API; Hermes `/health`,
  `/v1/models`, and a real Grok completion passed. The adapter is configured
  `hermes,codex` with separate mode-600 secrets; no OpenAI chat key is used.
  The Codex bridge service is active on loopback `47781`; `/health` and
  `/v1/models` pass. A live bridge completion returns the sanitized 502
  `codex_bridge_failed` because Mint's existing Codex OAuth refresh is 401
  expired. No logout/re-auth was attempted; manual Codex login on Mint remains
  the only missing provider gate.
- Staging image rollout — 2026-09-25: first Docker build exposed missing
  frontend builder prerequisites, then missing root `src/`/`packages/` inputs;
  commits `cbdd9356` and `9bdcb955` fixed both. The final isolated build
  completed 41/41 steps. Stage ran on 48778/47779 with a separate volume,
  passed Arra health (DB/FTS/MCP/plugins) and adapter Hermes ask, then was
  stopped without removing its volume before production cutover.
- Production cutover — 2026-09-25: latest existing archive
  `arra-mint-20260924T203047Z.tar.gz` was reused because its `oracle.db` and
  `vectors.db` hashes exactly matched the live volume; no blind duplicate
  backup was made. Existing `arra-mint_arra-oracle-data` was preserved. The
  `arra-mint` service now runs the pinned feature image plus adapter; both
  containers are healthy. Arra health reports DB connected, FTS 6/6, plugins
  `arra` and `oracle-dig` healthy, MCP catalog 32, consolidation worker on,
  entity backfill on with `dryRunOnly=true`; vector is deliberately unavailable
  because `ORACLE_EMBEDDER=none` (documented FTS fallback).
- Live acceptance — 2026-09-25: production gate passed auth negatives and
  positives, adapter health, canonical plugin registry, docs, FTS stats, and
  a real `/api/v1/ask` with `mode: llm` plus validated citations/no-evidence.
  MCP initialize, `tools/list` (28 tools), and authenticated `oracle_search`
  call passed. Listeners verified loopback-only on 47778 (Arra), 47779
  (adapter), 47781 (Codex bridge), and 8642 (Hermes). The semantic-vector gate
  remains intentionally pending; FTS-only acceptance is the active safe mode.
- Adapter corrections — 2026-09-25: Hermes citation objects are normalized
  to source indexes, and ask instructions containing “superseded” no longer
  trigger consolidation detection. Targeted adapter suite now passes 12/12;
  Codex fallback unit suite passes 4/4. Acceptance now skips vector checks
  when `ARRA_RUN_SEMANTIC_GATE=0`, matching the documented FTS-only mode, and
  validates required plugins from the health registry.
- Full-suite rerun — 2026-09-25: private deployment suites, typecheck,
  shell syntax, and diff checks passed. The full `bun test --isolate` rerun
  reached an unrelated `maw-plugin` Docker-build failure and then hung in its
  Docker credential/build subprocess; it was interrupted. No deployment test
  failure or lingering test/container process was left behind.
