# One item per video id, written once and read many times. On demand billing, so nothing is paid
# for while nobody reads.
resource "aws_dynamodb_table" "transcripts" {
  name         = "${var.name}-items"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "video_id"

  attribute {
    name = "video_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}
