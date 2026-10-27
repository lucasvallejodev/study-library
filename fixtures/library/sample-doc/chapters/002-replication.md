---
id: ch-002
title: Replication
order: 2
document: sample-doc
---

## Replication

Followers apply the leader's log in order, so every replica converges on the same state. The cost of a write is $O(1)$ amortised.

```ts
for (const record of log) state.apply(record);
```
