# Models (Phase 2/3 placeholder)

Not implemented in Phase 1 — there is no camera, detector, tracker, or embedding model yet; Phase 1
exercises the API/ledger/review flow with synthetic observations instead.

When Phase 2/3 start, this directory holds the **replaceable model interface** the spec requires, not
a hardcoded model choice:

- **Detector**: a benchmarked small object detector (Core ML on iOS if it meets device benchmarks).
- **Tracker**: ByteTrack-style multi-object association across frames, tolerant of brief occlusion and
  camera turns.
- **Embedding/re-identification**: fine-tuned on actual catalog shelf footage, not a generic off-the-shelf
  model — the spec is explicit that a generic model should not be assumed to distinguish similar SKUs.
- **Calibration config**: confidence thresholds for `PROVISIONAL` / `CONFIRMED` / `UNKNOWN` /
  `REVIEW_REQUIRED`, versioned and calibrated on held-out footage, not hand-tuned in code.

No accuracy claim (precision/recall, counting error, duplicate rate, unknown rate, latency) is made until
it is measured against the held-out replay set described in `docs/BUILDER_RESPONSE.md` §5, broken out by
lighting/occlusion condition — never as a single blended or universal percentage.
