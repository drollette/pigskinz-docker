FROM alpine:3.20

RUN apk add --no-cache sqlite curl rclone bash tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Runs once per container start rather than as a one-shot job, since a plain
# `docker compose up -d` sidecar with `restart: unless-stopped` has no
# built-in cron -- this loop is the scheduler. 24h between runs; override
# BACKUP_INTERVAL_SECONDS to change it.
CMD ["sh", "-c", "while true; do /usr/local/bin/backup.sh; sleep ${BACKUP_INTERVAL_SECONDS:-86400}; done"]
