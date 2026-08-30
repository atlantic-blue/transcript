import { JSDOM } from "jsdom";

// The caption endpoint answers 200 with an empty body unless the request carries a proof of origin
// token. The token is produced by the platform's own attestation program, which is JavaScript that
// expects a browser. So the program runs inside a JSDOM window here.
//
// The token is bound to a value. For the player the value is the visitor identity; for the caption
// endpoint it is the video id. Binding to the visitor identity returns an empty body.

const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

export interface Minter {
  mint(videoId: string): Promise<string>;
  expiresAt: number;
}

interface BotGuardModules {
  getChallenge: (config: {
    requestKey: string;
    fetchFunction: typeof fetch;
  }) => Promise<{
    program: string;
    globalName: string;
    interpreterJavascript: { privateDoNotAccessOrElseSafeScriptWrappedValue: string };
  }>;
  BotGuardClient: {
    create: (options: {
      program: string;
      globalName: string;
      globalObject: unknown;
    }) => Promise<{ snapshot: (args: { webPoSignalOutput: unknown[] }) => Promise<string> }>;
  };
  WebPoMinter: {
    create: (
      args: { integrityToken: string },
      signals: unknown[],
    ) => Promise<{ mintAsWebsafeString: (binding: string) => Promise<string> }>;
  };
  helpers: {
    GOOG_API_KEY: string;
    buildURL: (endpoint: string, useYouTubeAPI: boolean) => string;
    getHeaders: () => Record<string, string>;
  };
}

async function loadBotGuard(): Promise<BotGuardModules> {
  const [botguard, webpo, helpers] = await Promise.all([
    import("bgutils-js/botguard"),
    import("bgutils-js/webpo"),
    import("bgutils-js/utils"),
  ]);
  return {
    getChallenge: botguard.getChallenge as BotGuardModules["getChallenge"],
    BotGuardClient: botguard.BotGuardClient as unknown as BotGuardModules["BotGuardClient"],
    WebPoMinter: webpo.WebPoMinter as unknown as BotGuardModules["WebPoMinter"],
    helpers: helpers as unknown as BotGuardModules["helpers"],
  };
}

// The attestation program reads window, document and navigator off the global object, so they have
// to be there before it is evaluated.
function installBrowserGlobals(): void {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://www.youtube.com/",
    referrer: "https://www.youtube.com/",
    pretendToBeVisual: true,
  });
  const window = dom.window as unknown as Record<string, unknown>;
  for (const name of ["window", "self", "document", "location", "origin", "navigator"]) {
    const value = name === "window" || name === "self" ? dom.window : window[name];
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
}

export async function createMinter(fetchFunction: typeof fetch = fetch): Promise<Minter> {
  const { getChallenge, BotGuardClient, WebPoMinter, helpers } = await loadBotGuard();

  installBrowserGlobals();

  const challenge = await getChallenge({ requestKey: REQUEST_KEY, fetchFunction });
  const interpreter = challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!interpreter) throw new Error("the attestation challenge carried no program");
  new Function(interpreter)();

  const client = await BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObject: globalThis,
  });

  const signals: unknown[] = [];
  const snapshot = await client.snapshot({ webPoSignalOutput: signals });

  const response = await fetchFunction(helpers.buildURL("GenerateIT", false), {
    method: "POST",
    headers: {
      ...helpers.getHeaders(),
      "content-type": "application/json+protobuf",
      "x-goog-api-key": helpers.GOOG_API_KEY,
      "x-user-agent": "grpc-web-javascript/0.1",
    },
    body: JSON.stringify([REQUEST_KEY, snapshot]),
  });
  if (!response.ok) throw new Error(`the attestation service answered ${response.status}`);

  const body = (await response.json()) as [string, number];
  const integrityToken = body[0];
  const ttlSeconds = typeof body[1] === "number" ? body[1] : 3600;
  if (!integrityToken) throw new Error("the attestation service returned no integrity token");

  const minter = await WebPoMinter.create({ integrityToken }, signals);

  return {
    expiresAt: Date.now() + ttlSeconds * 1000,
    mint: (videoId: string) => minter.mintAsWebsafeString(videoId),
  };
}

let held: Minter | null = null;

// A warm container reuses the minter. The integrity token lasts twelve hours, so the attestation
// runs once rather than once per request.
export async function heldMinter(
  create: (f?: typeof fetch) => Promise<Minter> = createMinter,
): Promise<Minter> {
  if (held && held.expiresAt > Date.now() + 60_000) return held;
  held = await create();
  return held;
}

export function forgetMinter(): void {
  held = null;
}
