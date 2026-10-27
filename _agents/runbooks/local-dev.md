# Local development

```bash
corepack enable                 # pnpm 10 from packageManager
pnpm install
cp .env.example .env            # DATABASE_URL on port 5433, LIB_API_URL
brew install pandoc             # required for EPUB import (Calibre optional: brew install --cask calibre)
pnpm db:up                      # Postgres only
pnpm dev                        # http://localhost:3000 — migrates + indexes library/ on start
pnpm -s lib import samples/lewis-carroll_alices-adventures-in-wonderland_john-tenniel.epub
```

- `apps/web/.env.local` holds `DATABASE_URL` for Next (it only reads env files from `apps/web`). `LIBRARY_DIR` defaults to `<repo>/library`.
- Tests: `pnpm test` (offline, ~15 s; imports every sample into a temp library). Typecheck: `pnpm typecheck`.
- Claude Code desktop: `.claude/launch.json` defines the `web` dev server for the browser preview.
- Reset everything local: `docker compose down -v && rm -rf library/*/` (destroys annotations!).
