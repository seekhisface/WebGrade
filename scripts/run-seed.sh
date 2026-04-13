#!/bin/bash
# Run a Prisma seed script against a remote database
# Prompts for connection details, URL-encodes the password, and runs the chosen seed
#
# Usage: ./scripts/run-seed.sh [seed-name]
# Example: ./scripts/run-seed.sh demo
# Example: ./scripts/run-seed.sh           (interactive picker)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# --- Available seeds ---
# Map a friendly name → relative path

declare -a SEED_NAMES=("demo" "seo" "webwatch" "mike-demo")
declare -a SEED_PATHS=(
    "prisma/seed-demo.ts"
    "prisma/seed-seo.ts"
    "prisma/seed-webwatch.ts"
    "scripts/seed-mike-demo.ts"
)
declare -a SEED_DESCRIPTIONS=(
    "NovaPulse HR demo: org, user, site, 90 days of behavioral data"
    "SEO data: crawl results, keyword rankings, traffic snapshots"
    "WebWatch monthly report data"
    "Alternate demo dataset (Mike)"
)

SEED_ARG=${1:-}

echo "========================================"
echo "Prisma Seed Runner"
echo "========================================"
echo ""

# --- Pick the seed ---

SEED_PATH=""
if [ -n "$SEED_ARG" ]; then
    for i in "${!SEED_NAMES[@]}"; do
        if [ "${SEED_NAMES[$i]}" = "$SEED_ARG" ]; then
            SEED_PATH="${SEED_PATHS[$i]}"
            break
        fi
    done
    if [ -z "$SEED_PATH" ]; then
        echo "Unknown seed: $SEED_ARG"
        echo "Available: ${SEED_NAMES[*]}"
        exit 1
    fi
else
    echo "Available seeds:"
    for i in "${!SEED_NAMES[@]}"; do
        printf "  %d) %-12s — %s\n" "$((i + 1))" "${SEED_NAMES[$i]}" "${SEED_DESCRIPTIONS[$i]}"
    done
    echo ""
    read -p "Choose [1]: " CHOICE
    CHOICE=${CHOICE:-1}

    INDEX=$((CHOICE - 1))
    if [ $INDEX -lt 0 ] || [ $INDEX -ge ${#SEED_NAMES[@]} ]; then
        echo "Invalid choice."
        exit 1
    fi
    SEED_PATH="${SEED_PATHS[$INDEX]}"
fi

if [ ! -f "$SEED_PATH" ]; then
    echo "Error: seed file not found at $SEED_PATH"
    exit 1
fi

echo ""
echo "Selected seed: $SEED_PATH"
echo ""

# --- Connection details ---

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

# --- Confirm ---

echo "About to run: npx tsx $SEED_PATH"
echo "Against:      $DB_HOST/$DB_NAME"
echo ""
read -p "Continue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# --- Run ---

echo ""
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx tsx "$SEED_PATH"

echo ""
echo "========================================"
echo "Seed complete!"
echo "========================================"
