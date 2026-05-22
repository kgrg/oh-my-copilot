---
name: tdd
description: Red-green-refactor loop for behavior changes where tests are practical. Use with /tdd when a change can be specified by tests.
---

# TDD

Use `/tdd` when a change can be specified by tests.

Loop:
1. Write or identify a failing behavior test.
2. Make it pass with minimal code.
3. Refactor safely.
4. Run related checks.

Rules:
- Test behavior through public surfaces.
- Avoid brittle implementation tests.
- If TDD is impractical, explain why and use `/verify`.
