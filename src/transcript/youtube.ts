import { SCHEMA_VERSION, type Segment, type TranscriptItem } from "../contract.js";
import { heldMinter, type Minter } from "./attestation.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const SOURCE = "youtube.com timedtext, json3, with a proof of origin token bound to the video id";

export class VideoNotFound extends Error {}
export class PlatformRefused extends Error {}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
}

interface WatchPage {
  html: string;
  cookies: string;
}

export interface Fetched {
  title: string;
  track: CaptionTrack | null;
  events: TimedTextEvent[];
}

interface TimedTextEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

async function readWatchPage(videoId: string, f: typeof fetch): Promise<WatchPage> {
  const response = await f(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
  });
  if (!response.ok) throw new PlatformRefused(`the watch page answered ${response.status}`);
  const html = await response.text();
  const cookies = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
  return { html, cookies };
}

export function readTitle(html: string): string | null {
  const fromDetails = html.match(/"videoDetails":\{.*?"title":"(.*?)","lengthSeconds"/s);
  const raw = fromDetails?.[1];
  if (raw === undefined) return null;
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

export function readCaptionTracks(html: string): CaptionTrack[] {
  const found = html.match(/"captionTracks":(\[.*?\])/s);
  if (!found?.[1]) return [];
  try {
    return JSON.parse(found[1].replace(/\\u0026/g, "&")) as CaptionTrack[];
  } catch {
    return [];
  }
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

export async function fetchTranscript(
  videoId: string,
  deps: { fetch?: typeof fetch; minter?: () => Promise<Minter> } = {},
): Promise<TranscriptItem> {
  const f = deps.fetch ?? fetch;
  const getMinter = deps.minter ?? (() => heldMinter());

  const { html, cookies } = await readWatchPage(videoId, f);
  const title = readTitle(html);
  if (title === null) throw new VideoNotFound(`no video with the id ${videoId}`);

  const now = new Date().toISOString();
  const track = chooseTrack(readCaptionTracks(html));

  if (!track) {
    return {
      video_id: videoId,
      schema_version: SCHEMA_VERSION,
      fetched_at: now,
      title,
      has_captions: false,
      language_code: "",
      track_kind: "",
      track_name: "",
      segments: [],
      text: "",
      source: SOURCE,
    };
  }

  const minter = await getMinter();
  const token = await minter.mint(videoId);
  const url = `${track.baseUrl}&fmt=json3&c=WEB&pot=${encodeURIComponent(token)}`;

  const response = await f(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9",
      cookie: cookies,
      referer: `https://www.youtube.com/watch?v=${videoId}`,
      origin: "https://www.youtube.com",
    },
  });
  if (!response.ok) throw new PlatformRefused(`the caption endpoint answered ${response.status}`);

  const body = await response.text();
  // An empty body with a 200 is how the platform refuses a caption request it does not trust.
  if (body.length === 0) {
    throw new PlatformRefused("the caption endpoint returned an empty body");
  }

  let parsed: { events?: TimedTextEvent[] };
  try {
    parsed = JSON.parse(body) as { events?: TimedTextEvent[] };
  } catch {
    throw new PlatformRefused("the caption endpoint returned something that is not json");
  }

  const segments = eventsToSegments(parsed.events ?? []);
  if (segments.length === 0) {
    throw new PlatformRefused("the caption endpoint returned no usable segments");
  }

  return {
    video_id: videoId,
    schema_version: SCHEMA_VERSION,
    fetched_at: now,
    title,
    has_captions: true,
    language_code: track.languageCode ?? "",
    track_kind: track.kind === "asr" ? "asr" : "standard",
    track_name: trackName(track),
    segments,
    text: segments.map((s) => s.text).join(" "),
    source: SOURCE,
  };
}
