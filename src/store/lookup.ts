import { isVideoId, type LookupResult, type TranscriptItem } from "../contract.js";
import { PlatformRefused, VideoNotFound } from "../transcript/youtube.js";
import type { Store } from "./store.js";

export interface Lookup {
  (given: string): Promise<LookupResult>;
}

// An item is written once and read many times, so the store is asked before the platform is.
export function makeLookup(
  store: Store,
  fetchTranscript: (videoId: string) => Promise<TranscriptItem>,
): Lookup {
  return async (given: string): Promise<LookupResult> => {
    if (!isVideoId(given)) return { kind: "bad_id", given };

    const stored = await store.get(given);
    if (stored) return { kind: "ok", item: stored, cached: true };

    let item: TranscriptItem;
    try {
      item = await fetchTranscript(given);
    } catch (cause) {
      if (cause instanceof VideoNotFound) return { kind: "not_found", video_id: given };
      if (cause instanceof PlatformRefused) {
        return { kind: "upstream_failed", video_id: given, reason: cause.message };
      }
      const reason = cause instanceof Error ? cause.message : "the fetch failed";
      return { kind: "upstream_failed", video_id: given, reason };
    }

    await store.put(item);
    return { kind: "ok", item, cached: false };
  };
}
