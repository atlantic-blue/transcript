output "address" {
  description = "The address a person opens."
  value       = "https://${aws_cloudfront_distribution.page.domain_name}"
}

output "example" {
  description = "The address of one video, to check the page serves."
  value       = "https://${aws_cloudfront_distribution.page.domain_name}/videos?id=gyN9lV9QgyA"
}

output "table_name" {
  description = "The table one item per video id is written to."
  value       = aws_dynamodb_table.transcripts.name
}
