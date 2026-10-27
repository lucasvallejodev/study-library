# ADR 0001 — The `lib` CLI only talks to the HTTP API

Status: accepted (2026-10-27)

The plan allowed the CLI to import the same packages as the web app. We made it a pure HTTP client (`LIB_API_URL`) so one CLI works both on the server and from a laptop running Claude Code, and so imports always run through the job queue (one writer to `library/`, reports visible in the UI). Consequence: the server must be running for any `lib` command; editing documents uses `lib pull` / `lib push` bundles instead of direct file access.
