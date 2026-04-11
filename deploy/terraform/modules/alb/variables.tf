variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
}

# variable "certificate_arn" {
#   description = "ACM certificate ARN for HTTPS"
#   type        = string
#   default     = ""
# }

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
