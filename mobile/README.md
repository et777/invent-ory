# Mobile (Phase 2 placeholder)

Not implemented in Phase 1 — no iOS app exists yet. The API in `/api` already exposes everything the app
will need (`/sessions`, `observations:batch`, `events:batch`, `evidence-upload-url`), so Phase 2 is additive,
not a redesign of the backend.

Scope when Phase 2 starts, per the spec:

- iOS-first capture app: camera at 720p, 15-30 fps, inference on selected frames rather than every frame.
- On-device detector, multi-object tracker, and focus/blur/occlusion capture-quality checks.
- Local track ID per visible package; barcode read locally when present.
- Offline-capable session: queue observations/events locally, sync idempotently after reconnection using
  the same `clientRequestId`/conditional-put contract the API already enforces.
- Record camera intrinsics and motion/pose where available (spatial dedup is an evaluated feature, not a
  guarantee, per the spec).
- Prerecorded-video import through the same processing pipeline as live capture.

Android is explicitly deferred until an iOS implementation exists behind the same API (spec: "Provide an
Android implementation later behind the same API").

Before Phase 2 work starts, the account owner needs to supply: a target phone model for on-device
benchmarking (fps, battery, upload volume), and a real catalog CSV + 5-20 reference images per SKU for the
pilot's 50-200 SKUs (see `docs/BUILDER_RESPONSE.md` §8 open decisions).
