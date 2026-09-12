#!/bin/bash
set -eu

DB="${DATABASE_PATH:-/data/pigskinz.db}"
REMOTE="${RCLONE_REMOTE:-backup-crypt:pigskinz-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-45}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
TMP="/tmp/pigskinz-${STAMP}.db"

if [ ! -f "$DB" ]; then
  echo "No database at $DB yet -- skipping this run."
  exit 0
fi

# Never `cp` the live file -- a raw copy mid-write can capture a torn,
# inconsistent snapshot. sqlite3's own .backup command is the safe way to
# get a point-in-time copy of a live database, including one in WAL mode.
sqlite3 "$DB" ".backup '$TMP'"
gzip -9 "$TMP"

if [ -z "${RCLONE_CONFIG:-}" ] && [ ! -f "/run/secrets/rclone.conf" ]; then
  echo "No rclone config mounted (RCLONE_CONFIG or /run/secrets/rclone.conf) -- snapshot taken but not uploaded: ${TMP}.gz"
  exit 0
fi

RCLONE_ARGS=""
[ -f "/run/secrets/rclone.conf" ] && RCLONE_ARGS="--config /run/secrets/rclone.conf"

rclone copy "${TMP}.gz" "$REMOTE/" $RCLONE_ARGS
rclone delete "$REMOTE/" --min-age "${RETENTION_DAYS}d" $RCLONE_ARGS || true

rm -f "${TMP}.gz"

if [ -n "${HEALTHCHECK_URL:-}" ]; then
  curl -fsS -m 10 "$HEALTHCHECK_URL" || true
fi

echo "Backup complete: ${STAMP}"
