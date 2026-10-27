---
id: ch-001
title: What Is a Log?
order: 1
document: sample-doc
---

## What Is a Log?

A log is an append-only, totally ordered sequence of records ordered by time.[^1]

![A log as a sequence of numbered records](../assets/diagram.png)

| Offset | Record |
| --- | --- |
| 0 | `put x=1` |
| 1 | `put y=2` |

[^1]: Jay Kreps, *The Log*, 2013.
