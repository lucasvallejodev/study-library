# Study Library: Next.js app + ingestion tools (Calibre for MOBI/AZW, Pandoc for HTML -> Markdown)
FROM node:22-bookworm-slim

ARG PANDOC_VERSION=3.6.4
ARG TARGETARCH
# Set to true to bundle Playwright Chromium for JavaScript-heavy web pages (+~400 MB).
ARG WITH_PLAYWRIGHT=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl calibre \
  && curl -fsSL -o /tmp/pandoc.deb "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-${TARGETARCH:-amd64}.deb" \
  && dpkg -i /tmp/pandoc.deb \
  && rm -rf /tmp/pandoc.deb /var/lib/apt/lists/*

ENV QT_QPA_PLATFORM=offscreen \
    NEXT_TELEMETRY_DISABLED=1 \
    LIBRARY_DIR=/data/library

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/ingest/package.json packages/ingest/
COPY packages/anchoring/package.json packages/anchoring/
COPY packages/cli/package.json packages/cli/
RUN pnpm install --frozen-lockfile

RUN if [ "$WITH_PLAYWRIGHT" = "true" ]; then \
      pnpm add -w playwright && pnpm exec playwright install --with-deps chromium; \
    fi

COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
# Migrations and the library index run on start (apps/web/src/instrumentation.ts).
CMD ["pnpm", "start"]
