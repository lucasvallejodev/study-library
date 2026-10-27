# _agents — knowledge base for AI agents (and humans)

Start with `../AGENTS.md`. This folder holds everything that does not fit there.

| Folder | What is in it | Read it when |
| --- | --- | --- |
| `product/` | `mvp-plan.md` (original spec), `roadmap.md` (status per milestone, what is next) | Planning work, picking the next feature |
| `architecture/` | `overview.md`, `ingestion.md`, `reader-and-anchoring.md` | Changing how things work inside a package |
| `contracts/` | `library-layout.md`, `database.md`, `http-api.md`, `cli.md` | Touching anything other parts depend on |
| `runbooks/` | `local-dev.md`, `deploy-home-server.md`, `backup-restore.md`, `troubleshooting.md` | Running, deploying, fixing |
| `decisions/` | ADRs: where and why the build differs from the plan | Before "fixing" something that looks odd |
| `conventions/` | `coding.md`, `git.md`, `testing.md` | Before writing code or committing |

Keep these files current: when you change a contract or a command, update the matching doc in the same commit.
