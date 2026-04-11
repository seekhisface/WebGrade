output "web_repository_url" {
  description = "ECR repository URL for the web service"
  value       = aws_ecr_repository.web.repository_url
}

output "web_repository_arn" {
  description = "ECR repository ARN for the web service"
  value       = aws_ecr_repository.web.arn
}
