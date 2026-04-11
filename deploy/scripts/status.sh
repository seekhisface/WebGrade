#!/bin/bash
# Check status of WebGrade ECS deployment
# Usage: ./status.sh <environment>
# Example: ./status.sh staging

set -e

ENVIRONMENT=${1:-staging}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

CLUSTER_NAME="${ENVIRONMENT}-webgrade-cluster"
AWS_REGION=${AWS_REGION:-us-east-1}

echo "========================================"
echo "WebGrade Status: $ENVIRONMENT"
echo "========================================"

echo ""
echo "--- Cluster ---"
aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION \
    --query 'clusters[0].{Name:clusterName,Status:status,RunningTasks:runningTasksCount,PendingTasks:pendingTasksCount}' \
    --output table 2>/dev/null || echo "Cluster not found"

echo ""
echo "--- Services ---"
aws ecs describe-services --cluster $CLUSTER_NAME --services web --region $AWS_REGION \
    --query 'services[*].{Service:serviceName,Status:status,Running:runningCount,Desired:desiredCount,Rollout:deployments[0].rolloutState}' \
    --output table 2>/dev/null || echo "No services found"

echo ""
echo "--- Running Tasks ---"
TASK_ARNS=$(aws ecs list-tasks --cluster $CLUSTER_NAME --region $AWS_REGION \
    --query 'taskArns' --output text 2>/dev/null || echo "")

if [ -n "$TASK_ARNS" ] && [ "$TASK_ARNS" != "None" ]; then
    aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARNS --region $AWS_REGION \
        --query 'tasks[*].{Task:group,Status:lastStatus,Health:healthStatus,StartedAt:startedAt}' \
        --output table
else
    echo "No running tasks"
fi

echo ""
echo "--- Load Balancer ---"
ALB_DNS=$(aws elbv2 describe-load-balancers --names "${ENVIRONMENT}-webgrade-alb" --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$ALB_DNS" != "NOT_FOUND" ]; then
    echo "URL: http://$ALB_DNS"
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://$ALB_DNS/api/healthz" 2>/dev/null || echo "000")
    echo "Health check: HTTP $HEALTH"
else
    echo "ALB not found"
fi

