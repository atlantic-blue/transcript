export const SCHEMA_VERSION = 1;

export interface Segment {
  start_seconds: number;
  duration_seconds: number;
  text: string;
}

export interface TranscriptItem {
  video_id: string;
  schema_version: number;
  fetched_at: string;
  title: string;
  has_captions: boolean;
  language_code: string;
  track_kind: string;
  track_name: string;
  segments: Segment[];
  text: string;
  source: string;
}

// Why a read did not produce a transcript. The reader is told a different thing for each one, and
// the log names the same value, so a page and a log line can be lined up.
//
// The default is never "the video is missing". A page this code does not recognise is a refusal,
// because reporting a refusal as a missing video is how a working video came to read as deleted.
export type Cause =
  | "video_missing"
  | "bot_check"
  | "consent_wall"
  | "rate_limited"
  | "platform_error"
  | "unrecognised_page"
  | "captions_refused"
  | "captions_not_json"
  | "captions_empty";

export type LookupResult =
  | { kind: "ok"; item: TranscriptItem; cached: boolean }
  | { kind: "bad_id"; given: string }
  | { kind: "not_found"; video_id: string }
  | { kind: "upstream_failed"; video_id: string; cause: Cause; reason: string };

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(given: string): boolean {
  return VIDEO_ID_PATTERN.test(given);
}
