import type { Cause } from "../contract.js";

// The watch page arrives as one of several things and they all used to read the same way: as a
// missing video. This reads the shape of what arrived and names it.
//
// Only the shape is read, never the whole body. A watch page is over a megabyte, and writing a
// megabyte per request costs money and buries the line that matters.

export interface WatchPageShape {
  status: number;
  content_type: string;
  bytes: number;
  has_video_details: boolean;
  has_caption_tracks: boolean;
  has_player_response: boolean;
  playability: string;
  playability_reason: string;
  page_title: string;
  markers: string[];
}

// A full watch page happens to contain the words "consent" and "video unavailable" in its own
// scripts, so a marker means nothing on a page that carries a title. Every caller here reads the
// shape only after the title comes back missing.
const MARKERS: { name: string; pattern: RegExp }[] = [
  { name: "not a bot", pattern: /sign in to confirm[^<"]{0,40}not a bot/i },
  { name: "unusual traffic", pattern: /unusual traffic from your computer network/i },
  { name: "captcha", pattern: /g-recaptcha|recaptcha\/api\.js|\/sorry\/index/i },
  { name: "consent", pattern: /consent\.youtube\.com|before you continue to youtube/i },
  { name: "sign in", pattern: /"status"\s*:\s*"LOGIN_REQUIRED"/ },
  { name: "unplayable", pattern: /"status"\s*:\s*"(ERROR|UNPLAYABLE)"/ },
];

function first(html: string, pattern: RegExp): string {
  return pattern.exec(html)?.[1] ?? "";
}

export function readShape(status: number, contentType: string, html: string): WatchPageShape {
  return {
    status,
    content_type: contentType,
    bytes: html.length,
    has_video_details: html.includes('"videoDetails"'),
    has_caption_tracks: html.includes('"captionTracks"'),
    has_player_response: html.includes('"playabilityStatus"'),
    playability: first(html, /"playabilityStatus":\s*\{\s*"status"\s*:\s*"([A-Z_]+)"/),
    playability_reason: first(html, /"playabilityStatus":[^}]*?"reason"\s*:\s*"([^"]{0,120})"/).slice(0, 120),
    page_title: first(html, /<title[^>]*>([^<]{0,120})</i).trim(),
    markers: MARKERS.filter((m) => m.pattern.test(html)).map((m) => m.name),
  };
}

// The order matters, and the rule is that a verdict the platform states beats a word found in the
// body. A real watch page mentions consent.youtube.com in its own scripts, so the page for a video
// that genuinely does not exist carries the consent marker as well as its ERROR status. Reading the
// marker first would report a deleted video as a consent wall.
//
// A missing video is proved, never assumed: the platform has to say the video is unplayable. Every
// answer left over is a refusal, because a refusal is what an unexplained page usually is.
export function causeOf(shape: WatchPageShape): Cause {
  if (shape.status === 429) return "rate_limited";
  if (shape.status >= 500) return "platform_error";
  if (shape.status === 403) return "bot_check";
  if (shape.status !== 200) return "platform_error";

  const marked = (name: string): boolean => shape.markers.includes(name);

  // These three name the caller rather than the video, so nothing outranks them.
  if (marked("not a bot") || marked("unusual traffic") || marked("captcha")) return "bot_check";

  if (shape.has_player_response) {
    if (shape.playability === "ERROR" || shape.playability === "UNPLAYABLE") return "video_missing";
    if (shape.playability === "LOGIN_REQUIRED" || shape.playability === "AGE_VERIFICATION_REQUIRED") {
      return "bot_check";
    }
  }

  // Only now, with no verdict from the platform to read, is a word in the body worth anything.
  if (marked("consent")) return "consent_wall";
  return "unrecognised_page";
}

// What the log says about a cause, in the words a person reading it needs.
export const WHAT_HAPPENED: Record<Cause, string> = {
  video_missing: "the platform holds no video under that id",
  bot_check: "the platform asked the caller to prove it is not a machine",
  consent_wall: "the platform answered with a consent page instead of the video",
  rate_limited: "the platform is refusing this caller for asking too often",
  platform_error: "the platform answered with a status that is not a page",
  unrecognised_page: "the platform answered with a page that carries no video and names no reason",
  captions_refused: "the caption endpoint answered with an empty body, which is how it refuses",
  captions_not_json: "the caption endpoint answered with something that is not json",
  captions_empty: "the caption endpoint answered with json that carries no usable line",
};
