# Private full-stack Arra bundle

Mint is the sole Arra authority. MacBook Codex is the control plane and only
repo/config writer. Acer remains a restricted bridge with exactly:
`oracle_search`, `oracle_read`, `oracle_list`, `oracle_learn`, `oracle_reflect`.

The Mint host publishes Arra only on `127.0.0.1:47778`; the bridged container
process uses `0.0.0.0` only under the explicit private-container marker so the
host loopback publication is reachable. The adapter remains loopback-only in
that shared namespace on `127.0.0.1:47779`. OpenAI is approved remote
inference for the explicit curated corpus, not public hosting or federation.

## Operator sequence

1. Pin the current alpha commit and verify the Mint SSH, HTTP bearer token,
   MCP token (if separate),
   Hermes service, tunnel, and no concurrent writer.
2. On MacBook, enter the OpenAI key once into a Codex-owned mode-600 file. Never
   paste it into chat, shell output, Git, backup, or MCP. Stream it into Mint's
   mode-600 `/etc/arra-oracle/private.env` and `/etc/arra-oracle/openai.env`.
   The second file contains only the OpenAI key/model/rate settings; it must
   never contain Mint's bearer/MCP token. Set `OPENAI_CHAT_MODEL` only after a
   provider model-list preflight.
3. Run `manifest-check.ts` against the three approved roots. Transfer only the
   resulting file list over strict SSH; run the official `arra mine` path on
   Mint. Record source hashes, deterministic IDs, FTS rows, and vector rows.
4. Run staged Compose with `compose.staging.yml` on a separate data
   directory/ports; workers are disabled in this stage;
   run the health, plugin, auth, vector, ask, MCP, and corpus gates.
5. Create an application-consistent encrypted age backup. Verify decryption and
   boot an isolated restore with `restore-service.sh` before cutover.
6. Cut over briefly. If any critical gate fails, stop the new writer, restore
   the last good data/config snapshot, and return to FTS-only (`ORACLE_EMBEDDER`
   `none`) within the rollback deadline documented below.
7. After cross-device acceptance, remove only temporary completion cron
   `fdca8aa7c4d2`; retain the normal backup timer and health-only monitor.

## Safety boundaries

- `ORACLE_PRIVATE_DEPLOYMENT=1` rejects a missing `ARRA_API_TOKEN` (HTTP
  protection), mismatched stacked `ARRA_API_KEY`, and non-loopback adapter URLs.
  A separate MCP token is allowed, but never substitutes for HTTP protection.
- `ORACLE_ENTITY_BACKFILL_DRY_RUN=1` is deliberate: workers plan/queue only;
  human Studio/MCP approval is required for writes.
- The strict plugin policy loads exactly the bundled `arra` and `oracle-dig`
  manifests, rejects symlinks/shadowing, and fails on lifecycle errors.
- `oracle-dig` session reads must be constrained to the Arra project path. No
  generic `AGENTS.md`/`CLAUDE.md`, raw session tree, screenshots, keys, tokens,
  certificates, `.env*`, backups, or unrelated personal folders are allowed.
- Existing Mint auth is not replaced. OpenAI credentials are a separate
  provider secret; Codex/Hermes OAuth cannot satisfy `OPENAI_API_KEY`.

The vector template is versioned as `vector-server.private.json`. Install it
once while the service is stopped with
`install-vector-config.sh <data-dir> [config-path]`; the script refuses to
overwrite an existing config. Use `ORACLE_VECTOR_CONFIG_PATH` only for a
protected config stored outside the data volume.

## Backup/restore contract

Backups are refused while the authority is live. Stop Arra/vector writers and
run `backup-age.sh --authority-stopped` with the full 40-hex
`ARRA_PINNED_COMMIT`, generated JSON corpus manifest, and one `--source-root`
per manifest source. The script checkpoints SQLite, captures DB/vector WAL
sidecars and the verified Markdown snapshot, then age-encrypts to an atomic
new file. It never overwrites an existing archive. `restore-age.sh` verifies
the manifest, rejects symlink entries, checks the corpus/vector config, and
validates every checksum plus complete coverage of database-referenced source
files. A database source path absent from the curated manifest is a hard
failure; extend the manifest deliberately before backup. `restore-service.sh`
boots only a new isolated data
directory, reconstructs the allowlisted corpus, uses a clean mode-600 runtime
environment with separate random HTTP/MCP tokens, proves authenticated read,
FTS search, MCP initialize, loopback binding, and restart. Its default proof
is deliberately FTS-only; add `--require-vector --openai-env FILE
--vector-query QUERY --expected-source SOURCE` to require an OpenAI-backed
sqlite-vec semantic query. It never reuses a live port or reads corpus files
from the live checkout.

`acceptance.sh` is a full gate by default: set `ARRA_SEMANTIC_QUERY` and
`ARRA_EXPECTED_SOURCE`, then run the OpenAI provider/vector retrieval and
cited-ask checks. Use explicit `ARRA_RUN_SEMANTIC_GATE=0` or
`ARRA_RUN_ASK_GATE=0` only for a documented FTS-only rollback check.
