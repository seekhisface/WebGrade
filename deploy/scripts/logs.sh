#!/bin/bash
# View WebGrade ECS logs
# Usage: ./logs.sh <environment> [--follow] [--since DURATION]
# Example: ./logs.sh staging
# Example: ./logs.sh production --follow
# Example: ./logs.sh staging --since 1h

set -e

ENVIRONMENT=${1:-staging}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

shift || true

FOLLOW=""
SINCE="30m"

while [[ $# -gt 0 ]]; do
    case $1 in
        --follow|-f) FOLLOW="--follow"; shift ;;
        --since) SINCE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

LOG_GROUP="/ecs/${ENVIRONMENT}-webgrade-web"
AWS_REGION=${AWS_REGION:-us-east-1}

echo "Tailing logs: $LOG_GROUP (since $SINCE)"
echo "---"

aws logs tail "$LOG_GROUP" \
    --region $AWS_REGION \
    --since "$SINCE" \
    --format short \
    $FOLLOW
