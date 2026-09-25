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
