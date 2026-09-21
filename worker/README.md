# Worker (Phase 5 placeholder)

Not implemented in Phase 1. Per the spec, async GPU/ECS recognition is only built once benchmarks on
real footage justify it — Phase 1 uses on-device matching and/or the synchronous API Lambdas instead.

`infra`'s ObservabilityStack already provisions the `recognition` SQS queue and its dead-letter queue
so the IAM/queue shape exists ahead of time, with `workerDesiredCount` parameterized at `0`. When
Phase 5 is scoped, this package becomes an ECS task (EC2 GPU-backed capacity, not Fargate — see
`AWS_Visual_Inventory_Builder_Spec.md`) that consumes that queue.
