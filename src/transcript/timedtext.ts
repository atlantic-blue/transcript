import type { Segment } from "../contract.js";

// The pieces both entry points share. The watch page and the player endpoint describe a caption
// track with the same shape and hand back the same json3 body, so the choosing and the parsing live
// here rather than once per entry point.

export interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
}

export interface TimedTextEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

// A track a person wrote is preferred over one a machine generated, and English over anything else.
export function chooseTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const score = (t: CaptionTrack): number => {
    let n = 0;
    if (t.kind !== "asr") n += 2;
    if ((t.languageCode ?? "").startsWith("en")) n += 1;
    return n;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function trackName(track: CaptionTrack): string {
  return track.name?.simpleText ?? track.name?.runs?.[0]?.text ?? "";
}

export function eventsToSegments(events: TimedTextEvent[]): Segment[] {
  const segments: Segment[] = [];
  for (const event of events) {
    const text = (event.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({
      start_seconds: Math.round((event.tStartMs ?? 0) / 10) / 100,
      duration_seconds: Math.round((event.dDurationMs ?? 0) / 10) / 100,
      text,
    });
  }
  return segments;
}
