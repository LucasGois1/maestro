---
'@maestro/git': minor
'@maestro/cli': minor
---

Add `@maestro/git` package: `runGit` command runner, `computeBranchName` for all three strategies (conventional/custom/ask) with slugify + template interpolation and git refname sanitization, worktree lifecycle (`createWorktree`/`listWorktrees`/`removeWorktree` backed by `git worktree`), `commitSprint` that follows conventional commits with optional Co-Authored-By trailers, `detectDivergence` for resume checks (branch mismatch + new commits since timestamp), and platform detection (`detectRemote`) plus `buildPrCommand` / `executePrCommand` for GitHub (`gh`) and GitLab (`glab`) with a rich `renderPrBody`. Adds `maestro git status` and `maestro git cleanup --force` subcommands.
