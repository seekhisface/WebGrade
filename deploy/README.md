# WebGrade — AWS Deployment

## Architecture

```
Internet
    │
    ▼
ALB (public subnets)
    │
    ▼
ECS Fargate — web (private subnets, port 3000)
    │
    ▼
External PostgreSQL (existing cluster, not managed by Terraform)
```

Single-service deployment: one Next.js app (`web`) running on ECS Fargate behind an ALB. Database is an existing PostgreSQL cluster — provide the `DATABASE_URL` via Secrets Manager. Secrets stored in AWS Secrets Manager. Images stored in ECR.

## Naming Conventions

| Resource | Pattern | Example |
|----------|---------|---------|
| ECS Cluster | `{env}-webgrade-cluster` | `staging-webgrade-cluster` |
| ALB | `{env}-webgrade-alb` | `staging-webgrade-alb` |
| Secrets | `webgrade/{env}/*` | `webgrade/staging/anthropic-api-key` |
| Log Groups | `/ecs/{env}-webgrade-web` | `/ecs/staging-webgrade-web` |
| ECR Repo | `webgrade/web` | (shared across environments) |
| VPC CIDR | staging: `10.0.0.0/16`, prod: `10.1.0.0/16` | |

## Quick Start

### Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` works)
- Terraform >= 1.0
- Docker (for building images)
- `jq` (for deploy script status checks)

### 1. Provision infrastructure (one-time per environment)

```bash
cd deploy/terraform/environments/staging
terraform init
terraform apply
```

### 2. Set secrets (one-time per environment)

```bash
./deploy/scripts/setup-secrets.sh staging
```

This interactively prompts for all required secrets:
- `NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FINGERPRINT_SECRET`
- Google OAuth (`client_id` + `client_secret`)
- DataForSEO (`login` + `password`)
- Inngest (`event_key` + `signing_key`)
- PostHog (`key` + `host`)
- `DATABASE_URL` (full Prisma connection string)

### 3. Build and push image

```bash
./deploy/scripts/build-push.sh staging
```

### 4. Deploy

```bash
./deploy/scripts/deploy.sh staging --force
```

### 5. Monitor

```bash
./deploy/scripts/status.sh staging
./deploy/scripts/logs.sh staging --follow
```

## Scripts

| Script | Purpose |
|--------|---------|
| `build-push.sh <env> [version]` | Build Docker image and push to ECR |
| `deploy.sh <env> [--force] [--no-wait] [--wait-timeout M]` | Update ECS service and wait for rollout |
| `status.sh <env>` | Check cluster, service, tasks, ALB |
| `logs.sh <env> [--follow] [--since DURATION]` | Tail CloudWatch logs |
| `setup-secrets.sh <env>` | Set secret values in Secrets Manager |

## Environment Differences

| Setting | Staging | Production |
|---------|---------|------------|
| VPC CIDR | `10.0.0.0/16` | `10.1.0.0/16` |
| ECS CPU/Memory | 512 / 1024 | 1024 / 2048 |
| Desired tasks | 1 | 2 |
| Max tasks (autoscale) | 2 | 8 |
| Ingest rate limit | 100/min | 200/min |
| NEXTAUTH_URL | `https://staging.webgrade.io` | `https://app.webgrade.io` |

## HTTPS Setup

The ALB is provisioned with HTTP only by default. To enable HTTPS:

1. Request an ACM certificate for your domain
2. Uncomment the `certificate_arn` variable in `modules/alb/variables.tf`
3. Uncomment the HTTPS listener and HTTP redirect in `modules/alb/main.tf`
4. Pass `certificate_arn` in your environment's `main.tf`
5. `terraform apply`

## Remote State (recommended for teams)

Uncomment the `backend "s3"` block in each environment's `main.tf`, then create the bucket and DynamoDB table:

```bash
aws s3api create-bucket --bucket webgrade-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket webgrade-terraform-state --versioning-configuration Status=Enabled
aws dynamodb create-table \
    --table-name webgrade-terraform-locks \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
```

## Database Setup

The database is **not** managed by Terraform — use your existing PostgreSQL cluster.

### Create the database

```bash
psql "postgresql://USER:PASSWORD@your-cluster-endpoint:5432/postgres" \
  -c "CREATE DATABASE webgrade;"
```

### Run Prisma migrations

Generate the initial migration (once, locally):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@host:5432/webgrade" npx prisma migrate dev --name init
```

Apply migrations to a remote database:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@host:5432/webgrade?sslmode=require" npx prisma migrate deploy
```

The `DATABASE_URL` used at runtime by ECS is stored in Secrets Manager (`webgrade/{env}/db-credentials`) and set via `setup-secrets.sh`.
