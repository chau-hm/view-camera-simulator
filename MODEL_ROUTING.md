# View Camera Simulator — Codex Model Routing

| Custom agent | Default model | Reasoning | Purpose |
|---|---|---:|---|
| `vcs_orchestrator` | `gpt-5.6-sol` | high | Multi-domain planning and integration |
| `vcs_optics_geometry` | `gpt-5.6-sol` | high | Optics, Scheimpflug, canonical geometry |
| `vcs_threejs_rtt` | `gpt-5.6-sol` | high | Three.js, RTT, shaders, lifecycle |
| `vcs_ui_tasks` | `gpt-5.6-luna` | medium | UI, accessibility, routes, tasks |
| `vcs_test_worker` | `gpt-5.6-luna` | medium | Focused unit/integration/E2E implementation |
| `vcs_pr_reviewer` | `gpt-5.6-sol` | high | Independent merge gate |

`gpt-5.6-luna` replaces the earlier proposed Terra assignment for bounded
implementation and test work.

Install by copying `.codex/` into the repository root. Keep the existing
`AGENTS.md`, `.agents/skills/**`, and `docs/AI_AGENT_WORKFLOW.md`.
