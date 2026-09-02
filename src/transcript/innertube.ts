import { observe, withoutSecrets } from "../observe.js";
import { type CaptionTrack, type TimedTextEvent, chooseTrack, eventsToSegments } from "./timedtext.js";
import type { Segment } from "../contract.js";

// The watch page is not readable from every address. From a datacentre the platform serves a full
// page that carries no caption track and a player response asking the caller to prove it is a
// person, which is where the deployed function stopped.
//
// The player endpoint answers the same question for a phone client. That client is not asked for
// the proof, and the caption address it hands back needs no proof of origin token either, so this
// path reaches the text where the watch page cannot.

const CLIENT = {
  clientName: "IOS",
  clientVersion: "20.10.4",
  deviceMake: "Apple",
  deviceModel: "iPhone16,2",
  osName: "iOS",
  osVersion: "18.0.0.22A3354",
  hl: "en",
  gl: "US",
};

const CLIENT_NAME_ID = "5";

const USER_AGENT = "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)";

const PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

export const PLAYER_SOURCE =
  "youtube.com youtubei v1 player, ios client, timedtext json3, no proof of origin token";

// What the player endpoint gave back. A null track is a video that plays and carries no captions,
// which is an answer rather than a failure.
export interface PlayerRead {
  title: string;
  track: CaptionTrack | null;
  segments: Segment[];
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

// This is a second opinion, asked only after the first one failed. Anything unexpected returns null
// so the caller reports what the watch page said, rather than this path inventing a new reason.
export async function readThroughPlayer(videoId: string, f: typeof fetch): Promise<PlayerRead | null> {
  let answer: PlayerResponse;
  let status: number;
  try {
    const response = await f(PLAYER, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": USER_AGENT,
        "x-youtube-client-name": CLIENT_NAME_ID,
        "x-youtube-client-version": CLIENT.clientVersion,
      },
      body: JSON.stringify({
        videoId,
        context: { client: CLIENT },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });
    status = response.status;
    if (!response.ok) {
      observe("player_unusable", { video_id: videoId, reason: "the player endpoint answered a status", status });
      return null;
    }
    answer = (await response.json()) as PlayerResponse;
  } catch {
    observe("player_unusable", { video_id: videoId, reason: "the player endpoint could not be read" });
    return null;
  }

  const playability = answer.playabilityStatus?.status ?? "";
  const title = answer.videoDetails?.title;
  if (playability !== "OK" || title === undefined || title === "") {
    observe("player_unusable", {
      video_id: videoId,
      reason: "the player endpoint did not return a playable video",
      status,
      playability,
      playability_reason: answer.playabilityStatus?.reason ?? "",
    });
    return null;
  }

  const track = chooseTrack(answer.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
  observe("player_read", {
    video_id: videoId,
    status,
    has_caption_tracks: track !== null,
    track_kind: track?.kind ?? "",
    language_code: track?.languageCode ?? "",
  });
  if (!track) return { title, track: null, segments: [] };

  // The address is signed, so only its host and path are ever written.
  const address = `${track.baseUrl}&fmt=json3`;
  let body: string;
  try {
    const captions = await f(address, { headers: { "user-agent": USER_AGENT } });
    if (!captions.ok) {
      observe("player_captions_unusable", {
        video_id: videoId,
        reason: "the caption address answered a status",
        status: captions.status,
        address: withoutSecrets(address),
      });
      return null;
    }
    body = await captions.text();
  } catch {
    observe("player_captions_unusable", {
      video_id: videoId,
      reason: "the caption address could not be read",
      address: withoutSecrets(address),
    });
    return null;
  }

  let parsed: { events?: TimedTextEvent[] };
  try {
    parsed = JSON.parse(body) as { events?: TimedTextEvent[] };
  } catch {
    observe("player_captions_unusable", {
      video_id: videoId,
      reason: "the caption address did not answer with json",
      bytes: body.length,
      address: withoutSecrets(address),
    });
    return null;
  }

  const segments = eventsToSegments(parsed.events ?? []);
  if (segments.length === 0) {
    observe("player_captions_unusable", {
      video_id: videoId,
      reason: "the track holds no readable line",
      bytes: body.length,
      address: withoutSecrets(address),
    });
    return null;
  }

  observe("player_captions_read", {
    video_id: videoId,
    bytes: body.length,
    segments: segments.length,
    characters: segments.reduce((n, segment) => n + segment.text.length, 0),
  });
  return { title, track, segments };
}
