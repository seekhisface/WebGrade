output "peering_connection_id" {
  description = "VPC Peering Connection ID"
  value       = aws_vpc_peering_connection.ecs_to_rds.id
}
