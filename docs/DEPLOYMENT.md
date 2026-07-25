# Deployment branches

`main` is the development and integration branch. GitHub Pages is deployed only
from `production`. Pull requests, `main`, and other branches run the CI job
(lint, type-check, and tests); their Pages deploy job is skipped. Pull requests
merge into `main` without changing the live site, which changes only after
`production` advances. A Pages deployment is allowed only for a `push` or
manual `workflow_dispatch` on `refs/heads/production`.

## Normal release

Use a reviewed pull request from `main` to `production`. The fast-forward-only
equivalent, after review and with a clean working tree, is:

```bash
git fetch origin
git switch production
git pull --ff-only origin production
git merge --ff-only origin/main
git push origin production
```

Do not force-push `production`, and do not merge feature branches directly into
`production` without review. Verify CI before release. After release, verify the
`production` workflow's CI and deploy jobs, the deployment environment URL, and
the live Pages site. A `main` workflow must show CI success with deploy skipped.

## Pages-freeze handoff order

For the pages-freeze operation anchored at `pages-freeze-2026-07-25`, use this
order exactly:

1. Review and merge the deployment-freeze PR into `main`.
2. Observe the resulting `main` workflow run.
3. Confirm CI succeeds; deploy job is skipped; live GitHub Pages URL is unchanged.
4. Confirm `production` still points to the frozen SHA.
5. Only then convert PR #23 to Ready and merge it.
6. Observe PR #23's merge workflow.
7. Confirm CI succeeds; deploy job is skipped; live GitHub Pages URL remains unchanged.
8. Release later through a reviewed `main`-to-`production` update.

## Rollback

Rollback is a reviewed operation, never a force-push. Create a dedicated
rollback branch or pull request that restores the content anchored by the
known-good `pages-freeze-2026-07-25` tag (or a later reviewed release), then
advance `production` through that reviewed operation. Do not delete or move the
freeze tag. Verify the resulting production workflow, Pages deployment, and
live URL. Record the incident and reviewed rollback before resuming normal
releases.
