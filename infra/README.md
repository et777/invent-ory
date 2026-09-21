# Infra (AWS CDK v2, TypeScript)

Phase 1 infrastructure for the camera-based visible-shelf inventory system. Every resource created
by this app is tagged `project=inventory` via an App-level `Tags.of(app).add(...)` aspect in
`bin/infra.ts`, so any new stack automatically inherits it.

Stacks (see `bin/infra.ts` for wiring):

- **Data** — DynamoDB tables (`Products`, `Sessions`, `Observations`, `CountEvents`, `ReviewTasks`,
  on-demand billing, encrypted, point-in-time recovery) and a private `evidence` S3 bucket
  (`BLOCK_ALL` public access).
- **Auth** — Cognito User Pool + App Client (admin-created users, `orgId`/`siteId` custom attributes
  checked server-side).
- **Api** — API Gateway HTTP API with a Cognito JWT authorizer on every route, backed by Lambda
  functions with least-privilege per-table/bucket IAM grants.
- **Observability** — CloudWatch alarms (Lambda errors, API 5xx, recognition dead-letter queue
  depth), an SNS alert topic, a placeholder SQS + DLQ for the Phase 5 async recognition path, and a
  daily AWS Budget.
- **Web** — a private `web` S3 bucket plus a CloudFront distribution in front of it via Origin
  Access Control. The bucket lives in this stack (not Data) because the OAC bucket policy needs a
  reference back to the distribution's ARN — putting the bucket in a different stack than the
  distribution creates a cross-stack circular dependency.

## Environments

Configured via CDK context in `cdk.json` under `environments.dev` / `environments.prod`. Select
with `--context env=dev` (default) or `--context env=prod`. `prod` synth/deploy fails fast if the
account ID or alert email is still the `REPLACE_WITH_OWNER_*` placeholder — the account owner must
supply real values first.

## Commands

```bash
npm install
npm run build              # tsc
npx cdk synth --context env=dev   # offline synth, safe — does not touch AWS
npm test                   # CDK assertions tests
```

## Deploy / teardown — owner action required

`cdk deploy` and `cdk destroy` create and delete real, chargeable AWS resources and must **never**
be run without the account owner explicitly invoking deploy with a real AWS account/region
configured (see the spec's "Do not create chargeable AWS resources until the owner invokes deploy"
requirement). When authorized:

```bash
npx cdk bootstrap --context env=dev   # one-time per account/region
npx cdk deploy --all --context env=dev
```

Teardown for dev (preserves prod data — dev buckets/tables use `RemovalPolicy.DESTROY`, prod uses
`RemovalPolicy.RETAIN`):

```bash
npx cdk destroy --all --context env=dev
```
