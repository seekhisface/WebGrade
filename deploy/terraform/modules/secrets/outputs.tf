output "nextauth_secret_arn" {
  value = aws_secretsmanager_secret.nextauth_secret.arn
}

output "anthropic_api_key_arn" {
  value = aws_secretsmanager_secret.anthropic_api_key.arn
}

output "google_oauth_arn" {
  value = aws_secretsmanager_secret.google_oauth.arn
}

output "resend_api_key_arn" {
  value = aws_secretsmanager_secret.resend_api_key.arn
}

output "dataforseo_arn" {
  value = aws_secretsmanager_secret.dataforseo.arn
}

output "fingerprint_secret_arn" {
  value = aws_secretsmanager_secret.fingerprint_secret.arn
}

output "inngest_arn" {
  value = aws_secretsmanager_secret.inngest.arn
}

output "posthog_arn" {
  value = aws_secretsmanager_secret.posthog.arn
}

output "db_credentials_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "google_ads_developer_token_arn" {
  value = aws_secretsmanager_secret.google_ads_developer_token.arn
}

output "all_secret_arns" {
  description = "All secret ARNs for IAM policy"
  value = [
    aws_secretsmanager_secret.nextauth_secret.arn,
    aws_secretsmanager_secret.anthropic_api_key.arn,
    aws_secretsmanager_secret.google_oauth.arn,
    aws_secretsmanager_secret.resend_api_key.arn,
    aws_secretsmanager_secret.dataforseo.arn,
    aws_secretsmanager_secret.fingerprint_secret.arn,
    aws_secretsmanager_secret.inngest.arn,
    aws_secretsmanager_secret.posthog.arn,
    aws_secretsmanager_secret.db_credentials.arn,
    aws_secretsmanager_secret.google_ads_developer_token.arn,
  ]
}
