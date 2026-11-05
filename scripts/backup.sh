#!/bin/sh
# Writes a compressed dump of the site content to backups/. All content lives only in the database,
# so also copy these files off the server. COMPOSE selects another stack if needed.
#
# Contact messages are left out on purpose: the privacy notice promises deletion after 12 months, and
# old dump files could not keep that promise. Restoring therefore brings back an empty inbox.
#
# Restore into a running stack:
#   gunzip -c backups/portfolio-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U portfolio -d portfolio
set -eu
umask 077

COMPOSE="${COMPOSE:-docker compose}"
mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
partial="backups/.partial-$stamp.sql"
trap 'rm -f "$partial"' EXIT

# Written to a file first, because a pipe would hide a failed dump behind a successful gzip.
$COMPOSE exec -T db pg_dump --clean --if-exists --exclude-table-data=contact_message \
  -U portfolio -d portfolio > "$partial"

if ! grep -q "PostgreSQL database dump complete" "$partial"; then
  echo "The dump is incomplete, so no backup was written." >&2
  exit 1
fi

target="backups/portfolio-$stamp.sql.gz"
gzip -c "$partial" > "$target"
gunzip -t "$target"
echo "Wrote $target"
