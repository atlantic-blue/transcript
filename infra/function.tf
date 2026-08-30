data "archive_file" "bundle" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/.build/handler.zip"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "handler" {
  name               = "${var.name}-handler"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "handler" {
  statement {
    sid       = "ReadAndWriteOneTable"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.transcripts.arn]
  }

  statement {
    sid       = "WriteItsOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.handler.arn}:*"]
  }
}

resource "aws_iam_role_policy" "handler" {
  name   = "${var.name}-handler"
  role   = aws_iam_role.handler.id
  policy = data.aws_iam_policy_document.handler.json
}

resource "aws_cloudwatch_log_group" "handler" {
  name              = "/aws/lambda/${var.name}-handler"
  retention_in_days = var.log_retention_days
}

# There is no virtual private cloud here on purpose. A function in a private subnet needs a network
# address translation gateway to reach the platform, and that gateway charges by the hour whether
# anybody reads a page or not.
resource "aws_lambda_function" "handler" {
  function_name    = "${var.name}-handler"
  role             = aws_iam_role.handler.arn
  filename         = data.archive_file.bundle.output_path
  source_code_hash = data.archive_file.bundle.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]

  # The attestation program is JavaScript that runs in a browser shim, which needs room and takes a
  # few seconds on a cold read. A read that the store already holds returns in milliseconds.
  memory_size = 1536
  timeout     = 60

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.transcripts.name
      NODE_OPTIONS = "--enable-source-maps"
    }
  }

  depends_on = [aws_cloudwatch_log_group.handler]
}

resource "aws_lambda_function_url" "handler" {
  function_name      = aws_lambda_function.handler.function_name
  authorization_type = "NONE"
}

# A public function url needs two grants on the function, not one. The provider adds
# FunctionURLAllowPublicAccess for lambda:InvokeFunctionUrl by itself and stops there, so without
# the grant below the url answers 403 to every caller on every path, and the distribution in front
# of it answers 403 too. The grant carries no condition, which is what the other public function
# urls in this account carry.
resource "aws_lambda_permission" "public_invoke" {
  statement_id  = "FunctionURLAllowPublicInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handler.function_name
  principal     = "*"
}
