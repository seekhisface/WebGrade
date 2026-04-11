#!/bin/bash
# Set up secrets in AWS Secrets Manager for WebGrade
# Usage: ./setup-secrets.sh <environment>
# Example: ./setup-secrets.sh staging
#
# Run this once per environment before the first deploy.
# Secrets are created by Terraform; this script sets their values.

set -e

ENVIRONMENT=${1:-staging}

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

AWS_REGION=${AWS_REGION:-us-east-1}

echo "========================================"
echo "Setting up secrets for: $ENVIRONMENT"
echo "========================================"
echo ""

set_secret() {
    local secret_name=$1
    local secret_value=$2

    if aws secretsmanager describe-secret --secret-id "$secret_name" --region $AWS_REGION &>/dev/null; then
        aws secretsmanager put-secret-value \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region $AWS_REGION > /dev/null
        echo "  Updated: $secret_name"
    else
        echo "  WARNING: Secret $secret_name not found. Run 'terraform apply' first."
        return 1
    fi
}

# --- Simple string secrets ---

read -sp "NEXTAUTH_SECRET: " NEXTAUTH_SECRET
echo ""
set_secret "webgrade/${ENVIRONMENT}/nextauth-secret" "$NEXTAUTH_SECRET"

read -sp "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
echo ""
set_secret "webgrade/${ENVIRONMENT}/anthropic-api-key" "$ANTHROPIC_API_KEY"

read -sp "RESEND_API_KEY: " RESEND_API_KEY
echo ""
set_secret "webgrade/${ENVIRONMENT}/resend-api-key" "$RESEND_API_KEY"

read -sp "FINGERPRINT_SECRET: " FINGERPRINT_SECRET
echo ""
set_secret "webgrade/${ENVIRONMENT}/fingerprint-secret" "$FINGERPRINT_SECRET"

# --- Google OAuth (JSON) ---

echo ""
echo "Google OAuth:"
read -p "  GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -sp "  GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
echo ""
set_secret "webgrade/${ENVIRONMENT}/google-oauth" \
    "{\"client_id\":\"$GOOGLE_CLIENT_ID\",\"client_secret\":\"$GOOGLE_CLIENT_SECRET\"}"

# --- DataForSEO (JSON) ---

echo ""
echo "DataForSEO:"
read -p "  DATAFORSEO_LOGIN: " DATAFORSEO_LOGIN
read -sp "  DATAFORSEO_PASSWORD: " DATAFORSEO_PASSWORD
echo ""
set_secret "webgrade/${ENVIRONMENT}/dataforseo" \
    "{\"login\":\"$DATAFORSEO_LOGIN\",\"password\":\"$DATAFORSEO_PASSWORD\"}"

# --- Inngest (JSON) ---

echo ""
echo "Inngest:"
read -sp "  INNGEST_EVENT_KEY: " INNGEST_EVENT_KEY
echo ""
read -sp "  INNGEST_SIGNING_KEY: " INNGEST_SIGNING_KEY
echo ""
set_secret "webgrade/${ENVIRONMENT}/inngest" \
    "{\"event_key\":\"$INNGEST_EVENT_KEY\",\"signing_key\":\"$INNGEST_SIGNING_KEY\"}"

# --- PostHog (JSON) ---

echo ""
echo "PostHog:"
read -p "  NEXT_PUBLIC_POSTHOG_KEY: " POSTHOG_KEY
read -p "  NEXT_PUBLIC_POSTHOG_HOST: " POSTHOG_HOST
set_secret "webgrade/${ENVIRONMENT}/posthog" \
    "{\"key\":\"$POSTHOG_KEY\",\"host\":\"$POSTHOG_HOST\"}"

# --- Database URL ---

echo ""
echo "Database (DATABASE_URL for Prisma):"
echo "  Format: postgresql://user:pass@host:5432/webgrade?sslmode=require"
read -sp "  DATABASE_URL: " DATABASE_URL
echo ""
set_secret "webgrade/${ENVIRONMENT}/db-credentials" "$DATABASE_URL"

echo ""
echo "========================================"
echo "All secrets configured for $ENVIRONMENT!"
echo "========================================"
