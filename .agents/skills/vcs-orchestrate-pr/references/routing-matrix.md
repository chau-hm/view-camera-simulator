# Routing Matrix

## Small fix

Use when all are true:

- one primary concern
- no optical-model change
- no renderer lifecycle or shader change
- no more than about five relevant files
- focused tests can prove the result

Typical flow:

```text
UI/tasks or renderer implementation
→ verification
```

Recommended models:

- implementation: balanced coding model
- verification: strongest reasoning model when merge-critical, otherwise balanced model

## Standard PR

Use when:

- two related concerns are involved
- files cross a component boundary
- task or route metadata changes with UI
- a scene change needs unit, integration, and one E2E spec
- no new optical derivation or renderer architecture is required

Typical flow:

```text
orchestrator
├── implementation packet A
├── implementation packet B
└── verification
```

Recommended models:

- orchestrator: strongest reasoning model
- implementation: balanced coding model
- verification: strongest reasoning model

## High-risk simulation PR

Use when any apply:

- Scheimpflug, tilt, swing, focus-plane, DOF, or projection mathematics change
- canonical geometry or sign convention changes
- Ground Glass RTT, shaders, clipping, camera configuration, or render targets change
- scene subject ownership or disposal changes
- a bug crosses 2D, 3D, Ground Glass, and task evaluation
- existing tests can pass while hiding the defect

Typical flow:

```text
orchestrator
├── optics/geometry analysis
├── renderer/RTT analysis
├── bounded implementation
└── independent verification
```

Recommended models:

- orchestration, optics, renderer, final review: strongest reasoning model
- focused implementation and test mechanics: balanced coding model

## Temporary lightweight exploration

Use a lightweight model only for:

- locating files
- listing references to a symbol
- inventorying tests
- identifying existing helpers
- summarizing raw logs
- documentation-only updates

Do not ask a lightweight exploration agent to decide optical correctness, lifecycle ownership, or merge readiness.
