#!/bin/bash
# Build and push WebGrade Docker image to ECR
# Usage: ./build-push.sh <environment> [version]
# Example: ./build-push.sh staging
# Example: ./build-push.sh production v1.2.0

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT=${1:-staging}
VERSION=${2:-$ENVIRONMENT}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    echo "Usage: $0 <environment> [version]"
    exit 1
fi

echo "========================================"
echo "Building and pushing WebGrade"
echo "Environment: $ENVIRONMENT"
echo "Tag: $VERSION"
echo "========================================"

# Get AWS account info
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# Build the image
echo "Building web image..."
cd "$PROJECT_ROOT"
docker build \
    --platform linux/amd64 \
    -f Dockerfile \
    -t webgrade/web:$VERSION \
    .

# Tag for ECR
docker tag webgrade/web:$VERSION $ECR_URL/webgrade/web:$VERSION
docker tag webgrade/web:$VERSION $ECR_URL/webgrade/web:latest

# Push
echo "Pushing web image..."
docker push $ECR_URL/webgrade/web:$VERSION
docker push $ECR_URL/webgrade/web:latest

echo "========================================"
echo "Build and push complete!"
echo "Image: $ECR_URL/webgrade/web:$VERSION"
echo "========================================"
