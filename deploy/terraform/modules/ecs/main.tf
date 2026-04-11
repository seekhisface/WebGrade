# --- ECS Cluster ---

resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-webgrade-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# --- CloudWatch Log Group ---

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.environment}-webgrade-web"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# --- IAM: Task Execution Role ---

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "task_execution" {
  name = "${var.environment}-webgrade-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_base" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${var.environment}-webgrade-secrets-access"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.secret_arns
    }]
  })
}

# --- IAM: Task Role ---

resource "aws_iam_role" "task" {
  name = "${var.environment}-webgrade-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = var.tags
}

# --- Task Definition ---

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.environment}-webgrade-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name  = "web"
    image = "${var.web_image}:${var.environment}"

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "NEXTAUTH_URL", value = var.nextauth_url },
      { name = "EMAIL_FROM", value = var.email_from },
      { name = "INGEST_RATE_LIMIT_PER_MINUTE", value = tostring(var.ingest_rate_limit) },
      { name = "DATA_RETENTION_DAYS", value = tostring(var.data_retention_days) },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = var.db_credentials_secret_arn },
      { name = "NEXTAUTH_SECRET", valueFrom = var.nextauth_secret_arn },
      { name = "ANTHROPIC_API_KEY", valueFrom = var.anthropic_api_key_secret_arn },
      { name = "GOOGLE_CLIENT_ID", valueFrom = "${var.google_oauth_secret_arn}:client_id::" },
      { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${var.google_oauth_secret_arn}:client_secret::" },
      { name = "RESEND_API_KEY", valueFrom = var.resend_api_key_secret_arn },
      { name = "FINGERPRINT_SECRET", valueFrom = var.fingerprint_secret_arn },
      { name = "DATAFORSEO_LOGIN", valueFrom = "${var.dataforseo_secret_arn}:login::" },
      { name = "DATAFORSEO_PASSWORD", valueFrom = "${var.dataforseo_secret_arn}:password::" },
      { name = "INNGEST_EVENT_KEY", valueFrom = "${var.inngest_secret_arn}:event_key::" },
      { name = "INNGEST_SIGNING_KEY", valueFrom = "${var.inngest_secret_arn}:signing_key::" },
      { name = "NEXT_PUBLIC_POSTHOG_KEY", valueFrom = "${var.posthog_secret_arn}:key::" },
      { name = "NEXT_PUBLIC_POSTHOG_HOST", valueFrom = "${var.posthog_secret_arn}:host::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "web"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health-check || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = var.tags
}

# --- ECS Service ---

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  tags = var.tags

  lifecycle {
    ignore_changes = [task_definition]
  }
}

# --- Auto Scaling ---

resource "aws_appautoscaling_target" "web" {
  max_capacity       = var.web_max_count
  min_capacity       = var.web_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${var.environment}-webgrade-web-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
