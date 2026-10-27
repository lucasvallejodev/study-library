---
name: primer
description: Prepare the user to read a chapter they have not read yet — what it is about, key terms, the questions it answers, what to look for and what to look at in its figures — without spoiling it, saved as a short chapter note. Use for "/primer <doc> <chapter>", "prepare me for the next chapter", "what should I know before reading…", "pre-read".
argument-hint: <doc> [chapter]  [--spoilers]
---

# Primer before reading

Follow `_agents/conventions/skills.md`. No chapter given: use the next unread body chapter (`pnpm -s lib show <doc>`: first body chapter with `percent` 0 after the last one read) and confirm it in one line. No questions otherwise.

## Prepare

Read the chapter and skim its figures (`pnpm -s lib assets`). Read the previous chapter's notes and highlights (`pnpm -s lib annotations <doc> -c <previous>`) to connect with what the user already knows.

**No spoilers by default.** Fiction: never reveal plot events, twists or endings; set up characters, setting and themes to watch. Non-fiction: you may say what questions are answered, not the answers, unless `--spoilers`.

## Write (one screen, about 200–300 words)

```markdown
**In one line.** What this chapter is about and why it comes now.

**You already know.** 1–2 links back to earlier chapters or the user's highlights.

**Key terms.** term: short definition (3–6 terms the chapter relies on).

**Questions this chapter answers.**

1. …

**Watch for.** 2–3 things to notice: an argument's turning point, a figure worth studying (say which), a technique.

**Time.** ~N minutes (from the word count at 250 wpm).
```

## Save

Chapter note tagged `claude,primer`, so it shows under "Chapter notes" (it shows at the end of the chapter; tell the user to read the note first, e.g. from `/notebook?tag=primer` or this link). Suggest running `/study` or `/teach-back` after reading.
