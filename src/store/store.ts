import type { TranscriptItem } from "../contract.js";

export interface Store {
  get(videoId: string): Promise<TranscriptItem | null>;
  put(item: TranscriptItem): Promise<void>;
}

export class MemoryStore implements Store {
  private readonly items = new Map<string, TranscriptItem>();

  async get(videoId: string): Promise<TranscriptItem | null> {
    return this.items.get(videoId) ?? null;
  }

  async put(item: TranscriptItem): Promise<void> {
    this.items.set(item.video_id, item);
  }
}
