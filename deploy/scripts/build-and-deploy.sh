#!/bin/bash
# Build, push, and deploy WebGrade
# Usage: ./build-and-deploy.sh [environment]
# Example: ./build-and-deploy.sh staging
# Example: ./build-and-deploy.sh production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENVIRONMENT=${1:-staging}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    echo "Usage: $0 [environment]"
    exit 1
fi

echo "=== Step 1: Building and pushing Docker image ==="
"$SCRIPT_DIR/build-push.sh" "$ENVIRONMENT"

echo ""
echo "=== Step 2: Deploying to ECS ==="
"$SCRIPT_DIR/deploy.sh" "$ENVIRONMENT" --force

echo ""
echo "=== Done ==="
