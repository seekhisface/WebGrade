variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
