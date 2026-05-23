---
name: jira-ticket
description: Prepare Jira create, comment, and safe-update payloads with safe dry-run fallback. Use with /jira-ticket when work tracking is requested.
---

# Jira Ticket

Use `/jira-ticket` when work tracking is requested.

Do:
- Create from an approved plan or slice.
- Comment with implementation or verification evidence.
- Safely update known simple fields.
- Do not guess transitions, issue links, project keys, or secrets.
- If config is missing, output a dry-run payload.

Output:
- `Operation`
- `Target`
- `Payload`
- `Human action`
