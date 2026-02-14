View and analyze recent whatsapp-bridge logs.

Check these log files in the whatsapp-bridge directory:

1. **Main log** — `data/logs/bridge.log`: Read the last 100 lines. This contains all info/debug/warn/error logs in JSON format.
2. **Error log** — `data/logs/error.log`: Read the last 50 lines. This contains only error-level logs.

If running in Docker, also run: `docker logs --tail 100 whatsapp-bridge`

When analyzing logs:
- Look for `error` level entries and explain what went wrong
- Check for `warn` entries like disconnections or auth failures
- Look for patterns: repeated errors, reconnection loops, timeout spikes
- Check timestamps to correlate events
- If the user mentioned a specific issue, filter for relevant log entries

Summarize findings: what's working, what's failing, and any recommended actions.

Working directory: /Users/daniel/Documents/projects/claude-play/whatsapp-bridge
