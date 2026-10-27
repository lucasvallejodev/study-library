# Local development

```bash
corepack enable                 # pnpm 10 from packageManager
pnpm install
cp .env.example .env            # DATABASE_URL on port 5433, LIB_API_URL
brew install pandoc             # required for EPUB import (Calibre optional: brew install --cask calibre)
pnpm db:up                      # Postgres only
pnpm dev                        # http://localhost:3000 — migrates + indexes library/ on start
pnpm -s lib import fixtures/markdown/notes-on-logs.md
```

- `apps/web/.env.local` holds `DATABASE_URL` for Next (it only reads env files from `apps/web`). `LIBRARY_DIR` defaults to `<repo>/library`.
- Tests: `pnpm test` (offline; imports a generated EPUB and the fixtures into a temp library). Typecheck: `pnpm typecheck`.
- Claude Code desktop: `.claude/launch.json` defines the `web` dev server for the browser preview.
- Reset everything local: `docker compose down -v && rm -rf library/*/` (destroys annotations!).
