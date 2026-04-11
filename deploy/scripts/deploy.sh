#!/bin/bash
# Deploy WebGrade to ECS
# Usage: ./deploy.sh <environment> [--force] [--no-wait] [--wait-timeout MINUTES]
# Example: ./deploy.sh staging --force
# Example: ./deploy.sh production --wait-timeout 20

set -e

ENVIRONMENT=${1:-staging}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    echo "Usage: $0 <environment> [--force] [--no-wait] [--wait-timeout MINUTES]"
    exit 1
fi

shift || true

FORCE_DEPLOY=false
NO_WAIT=false
WAIT_TIMEOUT=15

while [[ $# -gt 0 ]]; do
    case $1 in
        --force) FORCE_DEPLOY=true; shift ;;
        --no-wait) NO_WAIT=true; shift ;;
        --wait-timeout) WAIT_TIMEOUT="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

CLUSTER_NAME="${ENVIRONMENT}-webgrade-cluster"
AWS_REGION=${AWS_REGION:-us-east-1}

echo "========================================"
echo "Deploying WebGrade"
echo "Environment: $ENVIRONMENT"
echo "Cluster:     $CLUSTER_NAME"
echo "Force:       $FORCE_DEPLOY"
echo "========================================"

# Validate cluster exists
CLUSTER_STATUS=$(aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION \
    --query 'clusters[0].status' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$CLUSTER_STATUS" != "ACTIVE" ]; then
    echo "Error: Cluster $CLUSTER_NAME not found or not active (status: $CLUSTER_STATUS)"
    echo "Run 'terraform apply' in deploy/terraform/environments/$ENVIRONMENT first."
    exit 1
fi

# Wait for service stabilization
wait_for_service() {
    local service_name=$1
    local max_attempts=$((WAIT_TIMEOUT * 4))
    local attempt=0

    echo "Waiting for $service_name to stabilize (timeout: ${WAIT_TIMEOUT}m)..."

    while [ $attempt -lt $max_attempts ]; do
        local status=$(aws ecs describe-services \
            --cluster $CLUSTER_NAME \
            --services $service_name \
            --region $AWS_REGION \
            --query 'services[0].{running:runningCount,desired:desiredCount,deployments:length(deployments),rollout:deployments[0].rolloutState}' \
            --output json)

        local running=$(echo "$status" | jq -r '.running')
        local desired=$(echo "$status" | jq -r '.desired')
        local deployments=$(echo "$status" | jq -r '.deployments')
        local rollout=$(echo "$status" | jq -r '.rollout')

        echo "  [$service_name] running=$running desired=$desired deployments=$deployments rollout=$rollout"

        if [ "$running" = "$desired" ] && [ "$deployments" = "1" ] && [ "$rollout" = "COMPLETED" ]; then
            echo "  $service_name is stable!"
            return 0
        fi

        if [ "$rollout" = "FAILED" ]; then
            echo "  $service_name deployment FAILED!"
            return 1
        fi

        attempt=$((attempt + 1))
        sleep 15
    done

    echo "  Timed out waiting for $service_name"
    return 1
}

# Update the web service
echo "Updating web service..."
if [ "$FORCE_DEPLOY" = true ]; then
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service web \
        --force-new-deployment \
        --region $AWS_REGION \
        --output text --query 'service.serviceName' > /dev/null
else
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service web \
        --region $AWS_REGION \
        --output text --query 'service.serviceName' > /dev/null
fi

if [ "$NO_WAIT" = false ]; then
    wait_for_service "web"
fi

# Show final status
echo ""
echo "--- Final Status ---"
aws ecs describe-services --cluster $CLUSTER_NAME --services web --region $AWS_REGION \
    --query 'services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount,Rollout:deployments[0].rolloutState}' \
    --output table

echo "========================================"
echo "Deploy complete!"
echo "========================================"
