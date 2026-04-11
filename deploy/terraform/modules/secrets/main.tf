# Secrets are created empty — values are set via setup-secrets.sh

resource "aws_secretsmanager_secret" "nextauth_secret" {
  name = "webgrade/${var.environment}/nextauth-secret"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name = "webgrade/${var.environment}/anthropic-api-key"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "google_oauth" {
  name = "webgrade/${var.environment}/google-oauth"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "resend_api_key" {
  name = "webgrade/${var.environment}/resend-api-key"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "dataforseo" {
  name = "webgrade/${var.environment}/dataforseo"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "fingerprint_secret" {
  name = "webgrade/${var.environment}/fingerprint-secret"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "inngest" {
  name = "webgrade/${var.environment}/inngest"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "posthog" {
  name = "webgrade/${var.environment}/posthog"
  tags = var.tags
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "webgrade/${var.environment}/db-credentials"
  tags = var.tags
}
