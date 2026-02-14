Send a test webhook request to the running whatsapp-bridge to verify it works end-to-end.

The argument $ARGUMENTS specifies the action to test. If empty, default to "list" (safest — read-only).

Determine the action and item from the argument:
- "list" or empty → action=list, no item needed
- "add <item>" → action=add, item=<item>
- "remove <item>" → action=remove, item=<item>
- "bought <item>" → action=bought, item=<item>
- "clear" → action=clear, no item needed

First check if the service is up by hitting the health endpoint:
```
curl -s http://localhost:3000/health
```

If healthy, send the test webhook. Examples:

For list (no item):
```
curl -s -X POST http://localhost:3000/webhook/ha-event \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'
```

For actions with items:
```
curl -s -X POST http://localhost:3000/webhook/ha-event \
  -H "Content-Type: application/json" \
  -d '{"action": "add", "item": "חלב"}'
```

If WEBHOOK_SECRET is set in .env, add the Authorization header:
```
-H "Authorization: Bearer <secret>"
```

Report:
- Whether the request succeeded (HTTP status + response body)
- The bot's reply text if successful
- Any errors and what they mean

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
