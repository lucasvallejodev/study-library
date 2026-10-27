# Git conventions

- Conventional Commits (`type(scope): summary`, imperative, ≤ 72 chars). Types: feat, fix, docs, test, build, chore, refactor, perf, style. Scopes: core, ingest, anchoring, web, cli, skills, agents.
- Commits use the repository owner's git identity (`git config user.name/email`). No `Co-Authored-By` lines, no "Generated with" footers.
- Never commit `library/`, `_temp/` contents, `.env*`, `backups/`.
- Work on a branch for anything larger than a fix; merge when tests and typecheck pass.
