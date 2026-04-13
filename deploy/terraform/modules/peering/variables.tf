variable "environment" {
  description = "Environment name"
  type        = string
}

variable "ecs_vpc_id" {
  description = "VPC ID where ECS tasks run"
  type        = string
}

variable "ecs_vpc_cidr" {
  description = "CIDR block of the ECS VPC"
  type        = string
}

variable "ecs_private_route_table_id" {
  description = "Route table ID for ECS private subnets"
  type        = string
}

variable "rds_vpc_id" {
  description = "VPC ID where the RDS cluster lives"
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

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
