variable "environment" {
  description = "Environment name"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "web_target_group_arn" {
  description = "ALB target group ARN for the web service"
  type        = string
}

variable "web_image" {
  description = "ECR image URI for the web service (without tag)"
  type        = string
}

variable "web_cpu" {
  description = "CPU units for the web container (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memory in MiB for the web container (hard limit)"
  type        = number
  default     = 1024
}

variable "web_desired_count" {
  description = "Desired number of web tasks"
  type        = number
  default     = 2
}

variable "web_max_count" {
  description = "Maximum number of web tasks for auto-scaling"
  type        = number
  default     = 6
}

# --- EC2 / ASG configuration ---

variable "instance_type" {
  description = "EC2 instance type for ECS hosts"
  type        = string
  default     = "t3.small"
}

variable "asg_min_size" {
  description = "Minimum EC2 instances in the ECS Auto Scaling Group"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum EC2 instances in the ECS Auto Scaling Group"
  type        = number
  default     = 4
}

variable "asg_desired_capacity" {
  description = "Initial desired EC2 instance count"
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# --- App config ---

variable "nextauth_url" {
  description = "Public URL for NextAuth"
  type        = string
}

variable "email_from" {
  description = "Email sender address"
  type        = string
  default     = "noreply@webgrade.io"
}

variable "ingest_rate_limit" {
  description = "Ingest rate limit per minute"
  type        = number
  default     = 100
}

variable "data_retention_days" {
  description = "Raw event retention period"
  type        = number
  default     = 90
}

# --- Secret ARNs ---

variable "secret_arns" {
  description = "All secret ARNs for task execution IAM policy"
  type        = list(string)
}

variable "db_credentials_secret_arn" {
  description = "DATABASE_URL secret ARN"
  type        = string
}

variable "nextauth_secret_arn" {
  description = "NEXTAUTH_SECRET secret ARN"
  type        = string
}

variable "anthropic_api_key_secret_arn" {
  description = "ANTHROPIC_API_KEY secret ARN"
  type        = string
}

variable "google_oauth_secret_arn" {
  description = "Google OAuth JSON secret ARN"
  type        = string
}

variable "resend_api_key_secret_arn" {
  description = "RESEND_API_KEY secret ARN"
  type        = string
}

variable "fingerprint_secret_arn" {
  description = "FINGERPRINT_SECRET secret ARN"
  type        = string
}

variable "dataforseo_secret_arn" {
  description = "DataForSEO credentials JSON secret ARN"
  type        = string
}

variable "inngest_secret_arn" {
  description = "Inngest keys JSON secret ARN"
  type        = string
}

variable "posthog_secret_arn" {
  description = "PostHog config JSON secret ARN"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
