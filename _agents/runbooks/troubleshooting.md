# Troubleshooting

| Symptom                                              | Cause / fix                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pandoc is not installed or not on PATH`             | `brew install pandoc` / use the Docker image                                                                                               |
| `ebook-convert is not installed`                     | MOBI/AZW need Calibre: `brew install --cask calibre` (adds `ebook-convert` under `/Applications/calibre.app/Contents/MacOS`) or use Docker |
| "DRM-protected" error                                | Kindle store file; only DRM-free books are supported                                                                                       |
| `A document with id "x" already exists`              | Use `lib reimport x`, or `lib import file --id x-2` for a copy                                                                             |
| `Cannot reach the Study Library server` from the CLI | Start `pnpm dev` or set `LIB_API_URL`                                                                                                      |
| CLI JSON starts with `> study-library@`              | Use `pnpm -s lib …`                                                                                                                        |
| Chapters missing or merged wrongly                   | Inspect `lib report <doc>`; try `--toc-depth 1`; fix with the `import-source` skill (`lib pull`/`push`)                                    |
| Highlights listed as "Orphaned"                      | The passage changed (re-import/edit). Delete or re-create them; they are never removed automatically                                       |
| Search finds nothing after editing files by hand     | `pnpm -s lib reindex <doc>`                                                                                                                |
| Import job stuck in `running` after a crash          | Restart the app: jobs go back to `queued` and resume                                                                                       |
