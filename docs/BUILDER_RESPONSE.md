# Builder response (pre-deployment)

Required by `AWS_Visual_Inventory_Builder_Spec.md` §"Builder response required before deploying". **No AWS resource in this plan has been created.** Nothing here authorizes spend; deployment requires an explicit owner action with a confirmed account/region (see §8).

## 1. Architecture and tradeoffs

Event-sourced ledger over DynamoDB, fronted by a JWT-authenticated HTTP API, with on-device (Phase 2+) detection/tracking and a thin server-side matching/review layer. Key tradeoffs made now, revisited later:

- **Counts are a projection of `CountEvents`, never a mutable counter.** Costs an extra read/replay per summary request, but makes idempotent retries, corrections and audit trails correct by construction instead of by discipline. This is the single most load-bearing decision in the system.
- **HTTP API + Lambda, not a REST API or always-on service**, for Phase 1: near-zero idle cost while usage is a handful of sessions/day, at the price of cold starts (acceptable for a review console and batch ingestion, not for a video path).
- **On-device matching first, GPU worker deferred (desired count 0).** The spec explicitly forbids assuming GPU is needed before benchmarking; an SQS queue + DLQ is provisioned as a placeholder so Phase 3 can add a worker without a schema change, but no ECS/EC2 GPU capacity exists yet.
- **DynamoDB over RDS**: access patterns are all single-table-style key lookups (by org, by session, by object) with no complex joins or aggregate queries beyond "sum events for a session," which a replay handles. Trades relational flexibility for predictable low-ops cost at this scale (50-200 SKUs, one session at a time).
- **Synthetic observations for Phase 1 demo.** Lets infra/API/review-flow be proven end-to-end before any real camera, model, or device exists — but the spec is explicit that synthetic-only results must never be reported as production-ready accuracy.

## 2. Repository tree

```
/infra    CDK v2 TypeScript: DataStack, AuthStack, ApiStack, ObservabilityStack, WebStack. dev/prod via --context env=
/api      Lambda handlers (Node 20, TS, AWS SDK v3) + shared lib (tenant isolation, idempotency, DynamoDB client)
/worker   Placeholder for async recognition consumer (Phase 3+); not deployed while desired count = 0
/mobile   iOS capture app (Phase 2+); not built yet
/web      React/Vite review console: sessions, session detail, review queue, comparison, export, finalize gate
/models   Model interface contracts, calibration config (Phase 2+)
/tests    Cross-cutting scenario tests (idempotency, tenant isolation, offline retry, replay) beyond per-workspace unit tests
/docs     openapi.yaml, this file, cost estimate, data model notes
/.github/workflows  CI: build + test on push, no deploy step
```

## 3. CDK resource plan and IAM permissions

All resources tagged `project=inventory` via an App-level `Tags.of(app).add(...)` aspect (owner requirement, verified by a CDK assertions test).

| Stack | Resources | IAM notes |
| --- | --- | --- |
| DataStack | 5 DynamoDB tables (on-demand), evidence S3 bucket (private, encrypted, lifecycle expiry), web S3 bucket (private, CloudFront-only access) | No principals granted here; grants happen per-consumer in ApiStack/WebStack |
| AuthStack | Cognito User Pool + Client with `orgId`/`siteId` custom attributes | No IAM; identity only |
| ApiStack | HTTP API with Cognito JWT authorizer on every route, one Lambda per route group | Each Lambda gets `grantReadWriteData`/`grantRead` scoped to only the tables/bucket it touches — no wildcard table or `s3:*` grants. Mobile/web clients hold only a Cognito JWT, never IAM credentials. |
| ObservabilityStack | SQS queue + DLQ (placeholder for Phase 3 worker), CloudWatch alarms (Lambda errors, API 5xx, DLQ depth), AWS Budgets budget + SNS email alert | Alarm/budget roles are service-linked; no new human-assumable roles |
| WebStack | CloudFront distribution with Origin Access Control over the web bucket | Bucket policy restricted to the specific distribution, not public |

## 4. API schema and database keys

Full OpenAPI 3 document: [`docs/openapi.yaml`](./openapi.yaml). Database keys exactly as specified in the spec's §"Data contracts and idempotency": `Products` (PK `ORG#<orgId>` / SK `SKU#<sku>`), `Sessions` (PK `ORG#<orgId>` / SK `SESSION#<sessionId>`), `Observations` (PK `SESSION#<sessionId>` / SK `OBJECT#<objectId>`), `CountEvents` (PK `SESSION#<sessionId>` / SK `EVENT#<eventId>`, unique `eventId` enforced via conditional put), `ReviewTasks` (PK `SESSION#<sessionId>` / SK `TASK#<taskId>`).

## 5. Model/data collection plan and measurable acceptance thresholds

Not started in Phase 1 (synthetic observations only). For Phase 2/3, before any accuracy claim is made:

- Collect 5-20 reference images per SKU across realistic shelf lighting/orientations for the pilot's 50-200 SKUs, plus a held-out replay video set with ground-truth object IDs, SKU IDs and counts (spec acceptance criterion 8).
- Report, per lighting/occlusion condition, not as a single blended number: SKU precision/recall, counting absolute error, duplicate rate, unknown rate, end-to-end latency.
- No universal accuracy percentage is published until measured on that held-out set; synthetic-data results are explicitly labeled as such and never presented as pilot-ready.

## 6. Exact commands to synth/deploy/test/tear down dev

```bash
npm install                                   # from repo root, installs all workspaces
npm run build                                 # builds infra, api, web
npm test                                      # runs unit tests in infra, api

# infra (safe - no AWS credentials/spend required for synth/test)
cd infra
npx cdk synth --context env=dev
npm test

# --- everything below requires the owner's explicit go-ahead, a confirmed AWS
# --- account/region, and is NOT to be run automatically ---
npx cdk bootstrap --context env=dev           # one-time per account/region
npx cdk deploy --all --context env=dev        # creates chargeable resources
npx cdk destroy --all --context env=dev       # dev teardown; prod tables/buckets use RETAIN and will not be deleted by this command
```

## 7. Cost estimate with assumptions

See [`docs/COST_ESTIMATE.md`](./COST_ESTIMATE.md) for the low-usage/peak breakdown. Headline: Phase 1 (no GPU worker, on-demand DynamoDB, low request volume) is expected to run near AWS free-tier levels per month; the dominant future cost driver is GPU worker hours if/when Phase 5 is triggered, which is why worker desired count defaults to 0 and is only raised after benchmarking.

## 8. Open decisions requiring owner input

1. **AWS account and region.** Spec prefers a Canadian region if data residency is required — needs an explicit choice before any deploy.
2. **Budget alert email/threshold** for the AWS Budgets alarm (currently a placeholder in dev context; deploy to prod will hard-fail synth without a real value).
3. **Custom domain** for the web console and API (optional; defaults to CloudFront/API Gateway default domains if not supplied).
4. **Cognito self-signup** on/off — currently admin-created users only, pending owner preference.
5. **Real catalog CSV and reference images** for the pilot's 50-200 SKUs, and a target phone model for Phase 2 on-device benchmarking.
6. **Pilot site/shelves** and ground-truth counting process for Phase 4 acceptance testing.

Implementation proceeds phase-by-phase per the spec; **no chargeable AWS resource is created until the owner explicitly invokes deploy** with account/region confirmed.
