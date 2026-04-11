output "alb_dns_name" {
  description = "ALB DNS name — point your domain here"
  value       = module.alb.alb_dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for docker push"
  value       = module.ecr.web_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

