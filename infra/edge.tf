# The cache key is the path and the id, and nothing else. Two readers asking for the same video get
# one answer from the edge, and compute is never reached a second time.
resource "aws_cloudfront_cache_policy" "by_video_id" {
  name        = "${var.name}-by-video-id"
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["id"]
      }
    }
    headers_config {
      header_behavior = "none"
    }
    cookies_config {
      cookie_behavior = "none"
    }
  }
}

# A function url refuses a request that carries somebody else's host header, so the managed policy
# that forwards everything except the host is the one to use.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "page" {
  enabled             = true
  comment             = "${var.name}: a video read as text"
  price_class         = "PriceClass_100"
  is_ipv6_enabled     = true
  default_root_object = ""

  origin {
    origin_id   = "handler"
    domain_name = replace(replace(aws_lambda_function_url.handler.function_url, "https://", ""), "/", "")

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "handler"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.by_video_id.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
