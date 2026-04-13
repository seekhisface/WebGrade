# --- VPC Peering Connection ---

resource "aws_vpc_peering_connection" "ecs_to_rds" {
  vpc_id      = var.ecs_vpc_id
  peer_vpc_id = var.rds_vpc_id
  auto_accept = true

  tags = merge(var.tags, { Name = "${var.environment}-webgrade-ecs-to-rds" })
}

# --- Route: ECS private subnets → RDS VPC ---

resource "aws_route" "ecs_to_rds" {
  route_table_id            = var.ecs_private_route_table_id
  destination_cidr_block    = var.rds_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.ecs_to_rds.id
}

# --- Route: RDS VPC → ECS VPC ---

resource "aws_route" "rds_to_ecs" {
  route_table_id            = var.rds_route_table_id
  destination_cidr_block    = var.ecs_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.ecs_to_rds.id
}

# --- Allow ECS → RDS on port 5432 ---

resource "aws_security_group_rule" "ecs_to_rds_postgres" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  cidr_blocks              = [var.ecs_vpc_cidr]
  security_group_id        = var.rds_security_group_id
  description              = "PostgreSQL from ${var.environment} ECS VPC"
}
