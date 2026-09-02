import { SCHEMA_VERSION, type Cause, type TranscriptItem } from "../contract.js";
import { observe, withoutSecrets } from "../observe.js";
import { heldMinter, type Minter } from "./attestation.js";
import { WHAT_HAPPENED, causeOf, readShape } from "./diagnosis.js";
import { PLAYER_SOURCE, type PlayerRead, readThroughPlayer } from "./innertube.js";
import { type CaptionTrack, type TimedTextEvent, chooseTrack, eventsToSegments, trackName } from "./timedtext.js";

export { chooseTrack, eventsToSegments, trackName };
export type { CaptionTrack, TimedTextEvent };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const SOURCE = "youtube.com timedtext, json3, with a proof of origin token bound to the video id";

export class VideoNotFound extends Error {}

// The cause travels with the refusal, so the page the reader gets and the line in the log name the
// same thing. It is not called cause, because Error already has a field by that name.
export class PlatformRefused extends Error {
  constructor(
    readonly why: Cause,
    message: string,
  ) {
    super(message);
  }
}

interface WatchPage {
  status: number;
  contentType: string;
  html: string;
  cookies: string;
}

export interface Fetched {
  title: string;
  track: CaptionTrack | null;
  events: TimedTextEvent[];
}

// A status that is not 200 is not thrown here. The body of a refusal is where the reason is
// written, so it is read and classified like any other answer.
async function readWatchPage(videoId: string, f: typeof fetch): Promise<WatchPage> {
  const response = await f(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
  });
  const html = await response.text().catch(() => "");
  const cookies = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    html,
    cookies,
  };
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

function captionStatusCause(status: number): Cause {
  if (status === 429) return "rate_limited";
  if (status === 403) return "bot_check";
  if (status >= 500) return "platform_error";
  return "captions_refused";
}

function itemFromPlayer(videoId: string, read: PlayerRead): TranscriptItem {
  const track = read.track;
  return {
    video_id: videoId,
    schema_version: SCHEMA_VERSION,
    fetched_at: new Date().toISOString(),
    title: read.title,
    has_captions: track !== null,
    language_code: track?.languageCode ?? "",
    track_kind: track === null ? "" : track.kind === "asr" ? "asr" : "standard",
    track_name: track === null ? "" : trackName(track),
    segments: read.segments,
    text: read.segments.map((s) => s.text).join(" "),
    source: PLAYER_SOURCE,
  };
}

export async function fetchTranscript(
  videoId: string,
  deps: { fetch?: typeof fetch; minter?: () => Promise<Minter> } = {},
): Promise<TranscriptItem> {
  const f = deps.fetch ?? fetch;
  const getMinter = deps.minter ?? (() => heldMinter());

  const page = await readWatchPage(videoId, f);
  const title = page.status === 200 ? readTitle(page.html) : null;

  // The title is missing for several different reasons and they used to be indistinguishable. The
  // shape of what came back is written here, once, whatever the reason turns out to be.
  if (title === null) {
    const shape = readShape(page.status, page.contentType, page.html);
    const why = causeOf(shape);
    observe("watch_page_unreadable", {
      video_id: videoId,
      cause: why,
      what_happened: WHAT_HAPPENED[why],
      ...shape,
    });
    if (why === "video_missing") throw new VideoNotFound(WHAT_HAPPENED[why]);

    // The watch page is readable from some addresses and refused at others, so a refusal here is
    // not the end of the question. The player endpoint is asked before the reader is told no, and
    // it answers where the watch page will not. A missing video is already proved above, so this
    // asks only about a refusal.
    const read = await readThroughPlayer(videoId, f);
    if (read) return itemFromPlayer(videoId, read);

    throw new PlatformRefused(why, WHAT_HAPPENED[why]);
  }

  const now = new Date().toISOString();
  const track = chooseTrack(readCaptionTracks(page.html));

  observe("watch_page_read", {
    video_id: videoId,
    status: page.status,
    bytes: page.html.length,
    has_caption_tracks: track !== null,
    track_kind: track?.kind ?? "",
    language_code: track?.languageCode ?? "",
  });

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
      cookie: page.cookies,
      referer: `https://www.youtube.com/watch?v=${videoId}`,
      origin: "https://www.youtube.com",
    },
  });
  const body = response.ok ? await response.text().catch(() => "") : "";

  // The address is signed and the request carried cookies and a token, so only the host and the
  // path are written. The rest is a credential.
  const refuse = (why: Cause): PlatformRefused => {
    observe("captions_unreadable", {
      video_id: videoId,
      cause: why,
      what_happened: WHAT_HAPPENED[why],
      status: response.status,
      content_type: response.headers.get("content-type") ?? "",
      bytes: body.length,
      address: withoutSecrets(url),
    });
    return new PlatformRefused(why, WHAT_HAPPENED[why]);
  };

  if (!response.ok) throw refuse(captionStatusCause(response.status));
  // An empty body with a 200 is how the platform refuses a caption request it does not trust.
  if (body.length === 0) throw refuse("captions_refused");

  let parsed: { events?: TimedTextEvent[] };
  try {
    parsed = JSON.parse(body) as { events?: TimedTextEvent[] };
  } catch {
    throw refuse("captions_not_json");
  }

  const segments = eventsToSegments(parsed.events ?? []);
  if (segments.length === 0) throw refuse("captions_empty");

  observe("captions_read", {
    video_id: videoId,
    status: response.status,
    bytes: body.length,
    segments: segments.length,
    characters: segments.reduce((n, segment) => n + segment.text.length, 0),
  });

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
