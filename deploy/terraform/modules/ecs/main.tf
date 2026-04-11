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

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# --- ECS-optimized AMI (Amazon Linux 2023) ---

data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
}

# --- IAM: EC2 instance role (for ECS agent) ---

resource "aws_iam_role" "ec2_instance" {
  name = "${var.environment}-webgrade-ec2-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ec2_ecs_agent" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_instance" {
  name = "${var.environment}-webgrade-ec2-instance"
  role = aws_iam_role.ec2_instance.name
  tags = var.tags
}

# --- Launch Template ---

resource "aws_launch_template" "ecs" {
  name_prefix   = "${var.environment}-webgrade-ecs-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_instance.name
  }

  vpc_security_group_ids = [var.ecs_security_group_id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_CONTAINER_METADATA=true" >> /etc/ecs/ecs.config
  EOF
  )

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      delete_on_termination = true
      encrypted             = true
    }
  }

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = "${var.environment}-webgrade-ecs-instance" })
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

# --- Auto Scaling Group ---

resource "aws_autoscaling_group" "ecs" {
  name_prefix         = "${var.environment}-webgrade-ecs-"
  vpc_zone_identifier = var.private_subnet_ids
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  desired_capacity    = var.asg_desired_capacity

  health_check_type         = "EC2"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  # Required for capacity provider managed termination protection
  protect_from_scale_in = true

  tag {
    key                 = "Name"
    value               = "${var.environment}-webgrade-ecs-asg"
    propagate_at_launch = false
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]
  }
}

# --- ECS Capacity Provider ---

resource "aws_ecs_capacity_provider" "main" {
  name = "${var.environment}-webgrade-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs.arn
    managed_termination_protection = "ENABLED"

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 100
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 2
    }
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = [aws_ecs_capacity_provider.main.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.main.name
    weight            = 1
    base              = 1
  }
}

# --- IAM: Task Execution Role ---

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

# --- Task Definition (EC2 launch type, bridge networking) ---

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.environment}-webgrade-web"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${var.web_image}:${var.environment}"
    cpu       = var.web_cpu
    memory    = var.web_memory
    essential = true

    portMappings = [{
      containerPort = 3000
      hostPort      = 0  # dynamic — allows multiple tasks per host
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "HOSTNAME", value = "0.0.0.0" },
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
  }])

  tags = var.tags
}

# --- ECS Service ---

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.main.name
    weight            = 1
    base              = 1
  }

  load_balancer {
    target_group_arn = var.web_target_group_arn
    container_name   = "web"
    container_port   = 3000
  }

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  ordered_placement_strategy {
    type  = "binpack"
    field = "memory"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  tags = var.tags

  depends_on = [aws_ecs_cluster_capacity_providers.main]

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# --- Service Auto Scaling ---

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
