---
name: ultraqa
description: Adversarial QA pass that tests behavior, failures, and regressions. Use with /ultraqa after implementation when shallow checks are not enough.
---

# UltraQA

Use `/ultraqa` after implementation when shallow checks are not enough.

Do:
- Test happy paths, hostile cases, and fallbacks.
- Prefer runnable checks over inspection.
- Record exact failures.
- Route fixes back to `/ralph` or `/ultrawork`.

Output:
- `Scenarios`
- `Results`
- `Regressions`
- `Fix recommendations`
