#!/bin/sh
set -e

echo "WhatsApp Bridge - Starting up..."

# Clean up stale Chromium lock files from previous runs
SESSION_DIR="/app/data/whatsapp-session/session"

if [ -d "$SESSION_DIR" ]; then
  echo "Cleaning stale Chromium lock files..."

  # Remove all known lock files
  rm -f "$SESSION_DIR/SingletonLock" 2>/dev/null || true
  rm -f "$SESSION_DIR/SingletonSocket" 2>/dev/null || true
  rm -f "$SESSION_DIR/SingletonCookie" 2>/dev/null || true
  rm -f "$SESSION_DIR/lockfile" 2>/dev/null || true
  rm -f "$SESSION_DIR/.lock" 2>/dev/null || true

  # Find and remove any other lock-like files
  find "$SESSION_DIR" -maxdepth 1 -name "*Lock*" -type f -delete 2>/dev/null || true
  find "$SESSION_DIR" -maxdepth 1 -name "*Socket*" -type f -delete 2>/dev/null || true

  echo "Lock cleanup complete"
else
  echo "Session directory doesn't exist yet, creating..."
  mkdir -p "$SESSION_DIR"
fi

# Ensure temp directory exists and has correct permissions
mkdir -p /home/botuser/tmp
chmod 755 /home/botuser/tmp

echo "Starting WhatsApp Bridge application..."
exec node dist/index.js
