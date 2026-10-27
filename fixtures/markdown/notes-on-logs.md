---
title: Notes on Logs
authors: [Study Library Fixtures]
description: A small Markdown document split into chapters at level-1 headings.
---

A short preface before the first chapter.

# Append-only storage

Logs are ordered, durable and replayable.

![A diagram](diagram.png)

## Segments

Segments are rolled over by size or time.

# Replication

Followers replay the leader's log.

```python
# not a heading inside a code block
print("replay")
```
