# AGENTS.md

## Project

View Camera Simulator is a browser-based learning tool for large-format camera movements.

Current MVP:
- 2D geometry diagrams
- simple 3D scene and ground-glass preview
- interactive rise/fall, tilt, and swing
- focus-plane and illustrative depth-of-field feedback

Do not add user accounts, persistence, multiplayer, photorealistic rendering, or unsupported camera movements unless the task explicitly requests them.

## Before changing code

- Read the repository `README.md` and relevant feature docs before implementation.
- Inspect `package.json` and the lockfile to identify the package manager and available scripts; do not assume npm, pnpm, or yarn.
- Keep changes scoped to the requested task. Do not perform unrelated refactors.
- Preserve existing public APIs and UI behaviour unless the task requires a breaking change.

## Simulation rules

- Treat simulation state as the single source of truth. 2D diagrams, 3D preview, controls, and explanatory text must derive from it.
- Keep optical/geometry calculations independent from UI components and rendering code.
- Use explicit units at boundaries: millimetres for distances and degrees for user-facing angles. Avoid unlabeled magic numbers.
- Do not claim optical precision beyond the implemented model. Mark heuristic blur or depth-of-field output as illustrative.
- Do not silently change movement sign conventions. Update labels, tests, and documentation together when a convention must change.

## Code style

- Follow the formatter, linter, TypeScript configuration, and patterns already present in the repository.
- Prefer small, typed, testable functions for geometry and state derivation.
- Avoid duplicated plane, vector, projection, or unit-conversion calculations.
- Keep rendering-specific state separate from canonical simulation state.

## Validation

- Run the repository's relevant lint, type-check, and test scripts before finishing.
- Add or update focused tests when changing geometry, movement behaviour, state derivation, or unit conversion.
- Manually verify that slider changes update both the 2D and 3D views consistently.
- Report any checks that could not be run and why.

## Documentation

- Put product requirements, optical derivations, UI copy, and detailed design decisions in dedicated project documentation—not in this file.
- Update README or feature documentation when setup, commands, configuration, or user-visible behaviour changes.
