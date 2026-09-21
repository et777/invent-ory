# Invent-ory

Camera-based inventory counting on AWS: guided phone walk-throughs count **visible** shelf packages. A scan is an observation of visible facings, not a full stock-on-hand figure — hidden/rear units need a manual count or separate source.

Full brief: [`AWS_Visual_Inventory_Builder_Spec.md`](./AWS_Visual_Inventory_Builder_Spec.md). Builder response (architecture, repo tree, IAM plan, API schema, cost estimate, open decisions) required before any deploy: [`docs/BUILDER_RESPONSE.md`](./docs/BUILDER_RESPONSE.md).

## Status: Phase 1

CDK infrastructure, auth, catalog import, session/event APIs, an immutable counting ledger, a review console and offline-friendly sync — exercised with **synthetic observations**, no camera/ML yet. See the spec's "Implement in phases" section for Phase 2-5.

**No AWS resource has been deployed.** Every resource this repo's CDK app can create is tagged `project=inventory`; deployment requires an explicit, separate action with a confirmed AWS account/region (see `docs/BUILDER_RESPONSE.md` §8 open decisions and §6 for exact commands).

## Repository layout

```
/infra    AWS CDK v2 (TypeScript) - DataStack, AuthStack, ApiStack, ObservabilityStack, WebStack
/api      Lambda handlers - event-sourced counting ledger, catalog, review, export
/worker   Async recognition consumer placeholder (Phase 3+; not deployed, desired count 0)
/mobile   iOS capture app (Phase 2+; not yet built)
/web      React/Vite review console
/models   Model interface contracts and calibration config (Phase 2+)
/tests    Cross-cutting scenario tests and coverage notes
/docs     OpenAPI spec, builder response, cost estimate
```

## Local development

```bash
npm install
npm run build
npm test

cd infra && npx cdk synth --context env=dev   # validates infra offline, no AWS credentials needed
```

Deploying (`cdk deploy`) is intentionally a separate, manual, owner-authorized step — see `docs/BUILDER_RESPONSE.md`.
