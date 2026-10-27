# Deploy on the home server

Requirements: Docker + Compose, ~2 GB disk for the image (Calibre is large), x86-64 or ARM64 Linux.

```bash
git clone <repo> /srv/study-library/app && cd /srv/study-library/app
cp .env.example .env
# edit .env: DB_PASSWORD, LIBRARY_HOST_DIR=/srv/study-library/library,
#            BACKUP_HOST_DIR=/srv/study-library/backups, APP_BIND=<LAN or Tailscale IP>, PUBLIC_URL=http://homeserver:3000
mkdir -p /srv/study-library/library /srv/study-library/backups
docker compose up -d --build
curl http://homeserver:3000/api/health
```

- Services: `db` (postgres:18, volume `pgdata`, port only on 127.0.0.1), `app` (Node 22 + Calibre + Pandoc, migrates on start), `backup` (nightly `pg_dump`, keeps `BACKUP_KEEP_DAYS`).
- Upgrade: `git pull && docker compose up -d --build`.
- JavaScript-heavy sites: build with `docker compose build --build-arg WITH_PLAYWRIGHT=true app` to bundle Chromium.
- Security: there is no login. Bind `APP_BIND` to the LAN/Tailscale interface; never port-forward. Optionally put Caddy with basic auth in front.
- From the laptop: set `LIB_API_URL=http://homeserver:3000` in the repo's `.env`; `pnpm -s lib health`, then the skills work against the server.
