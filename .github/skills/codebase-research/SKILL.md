---
name: codebase-research
description: Read the repo first, map evidence, and return the smallest useful implementation context. Use with /codebase-research before planning or asking when repo facts matter.
---

# Codebase Research

Use `/codebase-research` before planning or asking when repo facts matter.

Do:
- Find relevant files, symbols, tests, docs, and existing patterns.
- Separate evidence from inference.
- Name the likely change surface and risks.
- Ask nothing if the repo can answer it.

Output:
- `Evidence` — file paths and facts.
- `Likely path` — what should change.
- `Unknowns` — blockers only.
- `Next skill` — usually `/grill-me`, `/ralplan`, `/debug`, or `/tdd`.
