#!/bin/bash
# Run Prisma migration against a remote database
# Prompts for connection details, URL-encodes the password, and runs migrate dev/deploy
#
# Usage: ./scripts/run-migration.sh [migration-name]
# Example: ./scripts/run-migration.sh init

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

MIGRATION_NAME=${1:-}

echo "========================================"
echo "Prisma Migration Runner"
echo "========================================"
echo ""

# Prompt for connection details
read -p "Database host: " DB_HOST
read -p "Database port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Database name [webgrade]: " DB_NAME
DB_NAME=${DB_NAME:-webgrade}
read -p "Database user: " DB_USER
read -sp "Database password: " DB_PASSWORD
echo ""
read -p "Use SSL? [Y/n]: " USE_SSL
USE_SSL=${USE_SSL:-Y}

# URL-encode the password
ENCODED_PASSWORD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$DB_PASSWORD")

# Build connection string
SSL_PARAM=""
if [[ "$USE_SSL" =~ ^[Yy]$ ]]; then
    SSL_PARAM="?sslmode=require"
fi

DB_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}${SSL_PARAM}"

echo ""
echo "Connection: postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}${SSL_PARAM}"
echo ""

# Choose migration command
if [ -z "$MIGRATION_NAME" ]; then
    if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
        echo "Found existing migrations — running 'prisma migrate deploy'"
        read -p "Continue? [Y/n]: " CONFIRM
        CONFIRM=${CONFIRM:-Y}
        if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
            echo "Aborted."
            exit 0
        fi
        DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma migrate deploy
    else
        echo "No existing migrations found."
        read -p "Migration name [init]: " MIGRATION_NAME
        MIGRATION_NAME=${MIGRATION_NAME:-init}
        echo "Running 'prisma migrate dev --name $MIGRATION_NAME'"
        DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma migrate dev --name "$MIGRATION_NAME"
    fi
else
    echo "Running 'prisma migrate dev --name $MIGRATION_NAME'"
    DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma migrate dev --name "$MIGRATION_NAME"
fi

echo ""
echo "========================================"
echo "Migration complete!"
echo "========================================"
