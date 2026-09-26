# Save as scripts/migrate-all.sh
#!/bin/bash
# Runs every migration in order against local AND Neon.
# Safe to re-run — every migration uses IF NOT EXISTS guards.

set -e

LOCAL_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)

if [ -z "$NEON_URL" ]; then
  echo "Please set NEON_URL first:  export NEON_URL=postgresql://neondb_owner:npg_pngTyqGX5ZC3@ep-red-pine-b405heov-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
  exit 1
fi

echo "==> Applying migrations to LOCAL"
for f in backend/src/db/migrations/*.sql; do
  echo "   $f"
  psql "$LOCAL_URL" -f "$f" -q
done

echo ""
echo "==> Applying migrations to NEON"
for f in backend/src/db/migrations/*.sql; do
  echo "   $f"
  psql "$NEON_URL" -f "$f" -q
done

echo ""
echo "==> Verify:"
psql "$LOCAL_URL" -c "SELECT 'local' AS db, COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='public';"
psql "$NEON_URL"  -c "SELECT 'neon'  AS db, COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='public';"