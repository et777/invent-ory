# Cross-cutting test coverage

The spec requires automated tests for: event idempotency, correction/replay, offline retry, tenant
isolation, auth, duplicate view, adjacent identical products, occlusion, and wrong/unknown SKU — plus
infrastructure smoke tests and a dev teardown procedure that preserves prod data.

Per-workspace unit/assertion tests already satisfy the parts of this list that don't require a real
camera, detector, or tracker (all still Phase 2/3 work). This file is the map from spec requirement to
where it's proven, and an honest list of what's deferred.

| Requirement | Status | Where |
| --- | --- | --- |
| Event idempotency (retried batch doesn't double-count) | **Covered** | `api/test/events.test.ts` |
| Correction/replay (CONFIRM+REVERSE nets to zero; REASSIGN moves counts) | **Covered** | `api/test/projection.test.ts` |
| Tenant isolation (org A can't read/write org B's session) | **Covered** | `api/test/tenant.test.ts` |
| Auth (JWT authorizer required, not anonymous access) | **Covered** | `infra/test/infra.test.ts` |
| Optimistic revision check on observations (stale write rejected) | **Covered** | `api/test/observations.test.ts` |
| Finalize gated on zero open review tasks | **Covered** | `api/test/finalize.test.ts` |
| Infra smoke tests (tagging, public-access-block, JWT authorizer present) | **Covered** | `infra/test/infra.test.ts` |
| Dev teardown that preserves prod data | **Covered** | `infra/README.md` (`RemovalPolicy.RETAIN` in prod vs. `DESTROY` in dev) |
| Offline retry (queue locally, sync idempotently after reconnection, restart recovers without recounting) | **Partially covered** | The server-side half (idempotent batch replay) is exercised by `api/test/events.test.ts` and `observations.test.ts`. The client-side half (an actual on-device queue, app restart, reconnection) has no client yet — deferred to Phase 2 (`/mobile`). |
| Duplicate view (re-scanning a zone reconciles against existing scan records instead of double-counting) | **Deferred to Phase 3/4** | Requires the zone revisit registry and spatial/embedding reconciliation described in the spec's capture algorithm — no tracker or embedding model exists yet. |
| Adjacent identical products (avoid merging distinct boxes of the same SKU) | **Deferred to Phase 3** | Requires the detector/tracker producing real distinct-position evidence; nothing to test without real detections. |
| Occlusion (track survives brief occlusion, doesn't recount) | **Deferred to Phase 2/3** | Requires the on-device tracker (ByteTrack-style association) described in `/mobile` and `/models`. |
| Wrong/unknown SKU handling | **Partially covered** | The ledger already supports `UNKNOWN` state, `REASSIGN` events and a review queue (`api` + `web`). What's not yet testable: the actual barcode/embedding matching that produces a wrong-SKU candidate in the first place — that's `/models` Phase 2/3 work. |

Do not report the "Deferred" rows as tested. When Phase 2/3 add a real detector/tracker/embedding
model, add a replay-based test using the held-out ground-truth video set described in
`docs/BUILDER_RESPONSE.md` §5 for each of them before claiming coverage.
