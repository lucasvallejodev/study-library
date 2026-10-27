# Backup and restore

What needs backing up: the `library/` folder (content) and PostgreSQL (annotations, progress, study sessions). The index tables can be rebuilt from `library/`.

- Automatic: the `backup` service writes `library-YYYYMMDD-HHMM.sql.gz` to `BACKUP_HOST_DIR` nightly and prunes old dumps.
- Manual DB dump: `docker compose exec -T db pg_dump -U library library | gzip > library-$(date +%F).sql.gz`
- Second safety net: `pnpm -s lib export` writes `annotations.json` + `annotations.md` into every document folder, so a plain copy of `library/` carries your notes too.

Restore:

```bash
docker compose up -d db
gunzip -c library-20261027-0300.sql.gz | docker compose exec -T db psql -U library -d library
rsync -a backup/library/ /srv/study-library/library/
docker compose up -d app          # reindexes library/ on start
```

If only `library/` survived: start fresh, the app indexes all documents; annotations can be re-created from `annotations.json` (each entry is a valid `POST /api/annotations` body plus `id` — write a small script, ids are kept if you insert directly).
