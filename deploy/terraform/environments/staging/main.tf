terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state:
  # backend "s3" {
  #   bucket         = "webgrade-terraform-state"
  #   key            = "staging/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "webgrade-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "webgrade"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  environment = "staging"
  tags = {
    Environment = local.environment
    Project     = "webgrade"
  }
}

# --- Modules ---

module "ecr" {
  source = "../../modules/ecr"
  tags   = local.tags
}

module "networking" {
  source      = "../../modules/networking"
  environment = local.environment
  vpc_cidr    = var.vpc_cidr
  tags        = local.tags
}

module "secrets" {
  source      = "../../modules/secrets"
  environment = local.environment
  tags        = local.tags
}

module "alb" {
  source            = "../../modules/alb"
  environment       = local.environment
  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.public_subnet_ids
  security_group_id = module.networking.alb_security_group_id
  tags              = local.tags
}

module "ecs" {
  source               = "../../modules/ecs"
  environment          = local.environment
  private_subnet_ids   = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id
  web_target_group_arn = module.alb.web_target_group_arn
  web_image            = module.ecr.web_repository_url

  # Staging: smaller footprint
  web_cpu           = 512
  web_memory        = 1024
  web_desired_count = 1
  web_max_count     = 2

  # App config
  nextauth_url    = "https://staging.webgrade.io"
  email_from      = "noreply@webgrade.io"
  ingest_rate_limit   = 100
  data_retention_days = 90

  # Secrets
  secret_arns                 = module.secrets.all_secret_arns
  db_credentials_secret_arn   = module.secrets.db_credentials_arn
  nextauth_secret_arn         = module.secrets.nextauth_secret_arn
  anthropic_api_key_secret_arn = module.secrets.anthropic_api_key_arn
  google_oauth_secret_arn     = module.secrets.google_oauth_arn
  resend_api_key_secret_arn   = module.secrets.resend_api_key_arn
  fingerprint_secret_arn      = module.secrets.fingerprint_secret_arn
  dataforseo_secret_arn       = module.secrets.dataforseo_arn
  inngest_secret_arn          = module.secrets.inngest_arn
  posthog_secret_arn          = module.secrets.posthog_arn

  tags = local.tags
}
