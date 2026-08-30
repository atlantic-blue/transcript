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

export type LookupResult =
  | { kind: "ok"; item: TranscriptItem; cached: boolean }
  | { kind: "bad_id"; given: string }
  | { kind: "not_found"; video_id: string }
  | { kind: "upstream_failed"; video_id: string; reason: string };

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(given: string): boolean {
  return VIDEO_ID_PATTERN.test(given);
}
