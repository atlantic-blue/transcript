import type { LookupResult } from "./contract.js";
import { renderIndex, renderPage, renderUnknownRoute, type Rendered } from "./page/render.js";
import { DynamoStore } from "./store/dynamo.js";
import { makeLookup, type Lookup } from "./store/lookup.js";
import { fetchTranscript } from "./transcript/youtube.js";

export interface FunctionUrlEvent {
  rawPath?: string;
  rawQueryString?: string;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string; path?: string } };
}

export interface HttpAnswer {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// The edge holds a good answer for a day and asks again after five minutes at the reader's own
// cache. A failure is never held, so trying again reaches the platform.
export function cacheControlFor(result: LookupResult | null): string {
  if (result === null) return "public, max-age=300, s-maxage=86400";
  switch (result.kind) {
    case "ok":
      return "public, max-age=300, s-maxage=86400";
    case "bad_id":
    case "not_found":
      return "public, max-age=60, s-maxage=300";
    case "upstream_failed":
      return "no-store";
  }
}

function answer(page: Rendered, cacheControl: string): HttpAnswer {
  return {
    statusCode: page.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
    },
    body: page.html,
  };
}

export async function route(event: FunctionUrlEvent, lookup: Lookup): Promise<HttpAnswer> {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";

  if (method !== "GET" && method !== "HEAD") {
    return answer(renderUnknownRoute(), "no-store");
  }

  if (path === "/" || path === "") {
    return answer(renderIndex(), cacheControlFor(null));
  }

  if (path === "/videos" || path === "/videos/") {
    const given = event.queryStringParameters?.id ?? "";
    const result = await lookup(given);
    return answer(renderPage(result), cacheControlFor(result));
  }

  return answer(renderUnknownRoute(), cacheControlFor(null));
}

function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error("TABLE_NAME is not set");
  return name;
}

let lookup: Lookup | null = null;

export async function handler(event: FunctionUrlEvent): Promise<HttpAnswer> {
  lookup ??= makeLookup(new DynamoStore(tableName()), (id) => fetchTranscript(id));
  return route(event, lookup);
}
