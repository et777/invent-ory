# Cost estimate (Phase 1, pre-deployment)

**Not final.** Actual prices and instance availability must be checked for the chosen region in the AWS Pricing Calculator at deployment time; this is a planning-time approximation using assumptions stated below (spec §"Cost and operational controls"). All figures are order-of-magnitude, US pricing as a stand-in until a region is chosen.

## Assumptions

- 1 active device, 1 site, 1 scan session at a time (Phase 1 scope).
- Low-usage scenario: 10 scan sessions/day, 5 minutes/session, 1 selected crop every 4 seconds (~75 crops/session), average crop size 150 KB, no video clips retained.
- Peak scenario: 50 sessions/day, 10 minutes/session, 1 crop every 2 seconds (~300 crops/session), average crop size 250 KB, occasional short evidence clips (10s, ~3 MB) for ~10% of sessions.
- Worker desired count = 0 (no GPU/ECS cost in Phase 1 — on-device/CPU matching only).
- S3 evidence retention: 30 days (configurable `retentionDays` context param) before lifecycle expiry.
- DynamoDB on-demand capacity (no provisioned throughput to manage).

## Fixed costs (independent of scan volume)

| Item | Low-usage | Peak |
| --- | --- | --- |
| Cognito user pool (MAU-based, first 10k free tier) | ~$0 | ~$0 |
| CloudFront distribution (base) | ~$0 (pay per request/transfer below) | same |
| Budgets/CloudWatch alarms | ~$0-1/mo | ~$0-1/mo |
| SQS queue + DLQ (idle, no worker) | ~$0 | ~$0 |

## Per-scan / variable costs

| Item | Low-usage (10 sessions/day) | Peak (50 sessions/day) |
| --- | --- | --- |
| API Gateway HTTP API requests (~50 req/session: batches, summary, review) | ~15k req/mo → ~$0.02 | ~75k req/mo → ~$0.08 |
| Lambda invocations + duration (sub-second, low memory) | well within free tier | low single-digit $/mo |
| DynamoDB on-demand writes/reads (events, observations) | ~30k WCU-equiv/mo → ~$1-2/mo | ~150k WCU-equiv/mo → ~$5-8/mo |
| S3 evidence storage (30-day retention) | ~3.4 GB resident → <$1/mo | ~40 GB resident (incl. clips) → ~$1/mo |
| S3 PUT requests (crop uploads) | ~22.5k/mo → ~$0.10 | ~450k/mo → ~$2 |
| Data transfer out (review console + exports) | negligible | a few $/mo |

**Estimated total, Phase 1, no GPU worker: roughly $5-15/mo low-usage, $15-40/mo peak.** This excludes any future GPU worker: an always-on `g4dn.xlarge`-class ECS/EC2 instance alone would add on the order of $350-400/mo if ever enabled — which is exactly why Phase 5 (GPU/cloud stream) is conditional on measured need, not default-on.

## Controls

- AWS Budgets alarm at a configurable monthly threshold (owner-supplied `alertEmail` + limit; prod synth fails without a real value — see open decision in `BUILDER_RESPONSE.md`).
- CloudWatch alarms on API 5xx rate, Lambda error rate, and SQS DLQ depth (catches runaway retries before they generate cost).
- No GPU/EC2 capacity provisioned by default; worker desired count starts at 0 and requires a deliberate parameter change plus a benchmarking justification per the spec.
- S3 lifecycle expiration bounds evidence storage growth automatically rather than relying on manual cleanup.
