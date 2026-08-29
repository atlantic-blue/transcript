variable "region" {
  description = "The region the store and the function run in."
  type        = string
  default     = "eu-west-1"
}

variable "name" {
  description = "The prefix every resource is named with."
  type        = string
  default     = "transcript"
}

# The number is provisional. It is a guess until a real week of use is measured, and it should be
# set from what that week costs.
variable "monthly_budget_usd" {
  description = "The monthly cost this stack is expected to stay under, in dollars. Provisional."
  type        = string
  default     = "5"
}

variable "budget_email" {
  description = "Where the budget alarm is sent. No alarm is subscribed when this is empty."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "How long the function's logs are kept. Logs that are kept for ever cost for ever."
  type        = number
  default     = 14
}
