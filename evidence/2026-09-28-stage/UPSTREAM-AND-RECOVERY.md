# Upstream comparison and recovery evidence

## Official-code-first audit, 2026-09-28

Live `git ls-remote origin` returned default HEAD and alpha at `aaedb8d66d2afd25e6a0326bc76dc8bd29da2e79`; main is the older `77e175293c4a0289b182e2aae0cafe9ded119f39` (June 14). Fetch did not change the deployment branch or runtime.

Compared the official source against the deployment branch: authenticated OpenAPI forwarding, optional federation mounting, bundled Simple Mode HTML, and request-owned vector search/export connections are not merged into alpha. Open PR inventory contains #3056 (SQLite extension bootstrap), #3031/#3029 (FTS ranking), #3023 (MCP session catalogue), and our #3065. These are not evidence of merged fixes; no unreviewed PR was deployed.

Retain official alpha as the base and existing official feature implementations. Private provider routing, network restrictions, curated ingestion and backup wiring remain deployment-specific. Keep demonstrated compatibility fixes narrow; do not describe them as upstream-accepted.

## Hybrid connection repair

Production reproduced `warning: Vector search error: sqlite-vec not connected` after vector-only search. Search/export routes closed factory-cached connections. Commit `d4d14f0d` switches only those request-owned routes to uncached factory instances and reports failed hybrid vector legs truthfully.

Regression RED then GREEN; focused tests 12/12; complete HTTP vector suite rerun 104/104; typecheck passed. An earlier full run had one timing-sensitive provider-config failure, which passed individually and on full rerun.

Mint disk reached 100%. Inspected Docker images and cache descriptions: Arra builds only. Exact-ID pruning reclaimed nothing; Docker dangling build-cache prune reclaimed 6.881 GB. No data volumes, runtime images, models or backups removed. Cache is rebuildable. About 2 GiB free remains: disk headroom is still limited.

Repair image built against verified `private-8cde020a` using the committed bounded-space Dockerfile. New runtime image `arra-oracle-v3:private-e7068182`, ID `sha256:066e9f31da9707908fb04244fb30067b9468256382deea479b7f3ba6e5176c8f`.

Staging and production both passed sequential hybrid → vector-only → hybrid calls, returning respectively 20, 3, 20 vector-contributing hits with no warnings. Production cited backup-policy answer also returned LLM mode, evidence and three citations before the repair; no-evidence behavior was previously proven in staging.

## Encrypted vector recovery, 12:35 UTC onward

Application-consistent `arra-vector-20260928T1235Z.age` includes 848 database records, all 848 vectors, 94 curated source files, vector config, private/embedding Compose files and a secret-free environment example. Runtime credentials and recovery identity excluded.

Mint and Mac archive SHA-256 both `57a2776853923567103e5af6a67fed5334e2fb74c9c9ab9bdc960f2ed233847a`. Mac decryption and every archive checksum passed through the existing restore script. The decrypted Mac copy was transferred back through strict SSH into a new isolated Mint restore directory; checksum verification passed there again.

Started `arra-vector-restore-20260928` from the exact production image on loopback port 49778, with only restored data mounted. Workers, watcher and LLM calls disabled; production database not mounted. Existing local Ollama provides embeddings.

Live recovery results: healthy, FTS 848/848, vectors 848/848, zero pending, hybrid retrieval with ten vector-contributing hits; Simple Mode HTML 200; Studio HTML 200; valid MCP initialize response 200. This proves restored application boot and retrieval, not merely archive extraction.

Post-restart recovery check passed: hybrid search 200, vectorAvailable true, three vector-contributing hits, no warning. Disposable recovery and staging containers stopped afterward; their data retained.

Pending: normal encrypted backup scheduling/off-host maintenance, final device-local gates, Git push/review and completion-automation removal only after all gates pass.
