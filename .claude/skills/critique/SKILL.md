---
name: critique
description: Examine the argument of a chapter or a highlighted claim — state it in its strongest form, list its assumptions and evidence, then the best counterarguments, limits and what still holds — and save the analysis as a note. Use for "/critique <doc> <chapter|a-id>", "is this right", "steelman this", "what are the counterarguments", "critical reading".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [--depth quick|full]
---

# Critique an argument

Follow `_agents/conventions/skills.md`. Fair to the author first, critical second.

## Ask (one message, only if unclear)

1. Which claim [the highlight, or the chapter's main thesis]
2. Depth [quick: one screen; full: with sources]

## Read

Read the chapter (and highlight) and its figures and tables (`pnpm -s lib assets`): charts and data often carry the evidence. Find the thesis, the supporting claims, the evidence offered for each and the unstated assumptions.

`--depth full`: search the web for the strongest published counterarguments, replications or later corrections, and open them before citing (see the honesty rules).

## Write

```markdown
**The claim, at its strongest.** The author's argument in 2–4 sentences, as they would want it put.

**Rests on.**

- Assumption or evidence → how strong it is (cite the passage)

**Best objections.**

1. The objection, who makes it (if sourced) and what it would change.

**Limits.** Where the claim stops applying (context, scale, time, data).

**What survives.** What still holds after the objections, and how confident to be.

**Your turn.** One question that asks the user to take a position.
```

Mark your own judgement as such; do not present a contested view as settled.

## Save

Note on the highlight or chapter note, tags `claude,critique`. Offer a short follow-up: the user answers "Your turn" and you respond, without saving unless asked.
