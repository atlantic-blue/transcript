terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.80" }
    archive = { source = "hashicorp/archive", version = "~> 2.6" }
  }

  # The state lives in Amazon Simple Storage Service. The bucket is created by the pipeline before
  # this runs, because a state that lives in a sandbox dies with the sandbox. The bucket name is
  # passed in at init time, so no account number is written into this repository.
  backend "s3" {
    key          = "transcript/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project   = "transcript"
      managedby = "terraform"
    }
  }
}

# Amazon CloudFront reads its managed policies from this region whatever the stack region is.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
