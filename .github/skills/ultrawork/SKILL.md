---
name: ultrawork
description: High-throughput execution for many independent small tasks. Use with /ultrawork when work can be batched safely.
---

# Ultrawork

Use `/ultrawork` when there are many independent, low-conflict work items.

Do:
- Batch independent tasks.
- Avoid shared-file collisions.
- Verify each batch.
- Escalate ambiguous or risky branches to `/ralplan`.

Output:
- `Batch`
- `Completed`
- `Failed/blockers`
- `Verification`
