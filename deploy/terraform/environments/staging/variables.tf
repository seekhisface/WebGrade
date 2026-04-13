variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# --- Existing RDS VPC (for VPC peering) ---

variable "rds_vpc_id" {
  description = "VPC ID where the existing RDS cluster lives"
  type        = string
}

variable "rds_vpc_cidr" {
  description = "CIDR block of the RDS VPC"
  type        = string
}

variable "rds_route_table_id" {
  description = "Main route table ID of the RDS VPC"
  type        = string
}

variable "rds_security_group_id" {
  description = "Security group ID of the RDS cluster"
  type        = string
}

