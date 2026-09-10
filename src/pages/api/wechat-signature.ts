import type { APIRoute } from "astro";
import { WECHAT_APP_ID, WECHAT_APP_SECRET } from "astro:env/server";
import { createHash, randomBytes } from "node:crypto";
import { SITE } from "@/config";

export const prerender = false;

const WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin";
const CACHE_SAFETY_WINDOW_MS = 5 * 60 * 1000;

interface ExpiringValue {
  value: string;
  expiresAt: number;
}

interface WechatResponse {
  access_token?: string;
  ticket?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

class WechatApiError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "WechatApiError";
  }
}

let accessTokenCache: ExpiringValue | undefined;
let ticketCache: ExpiringValue | undefined;
let accessTokenRequest: Promise<ExpiringValue> | undefined;
let ticketRequest: Promise<ExpiringValue> | undefined;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isFresh(entry: ExpiringValue | undefined) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

async function fetchWechat(
  url: URL,
  init?: RequestInit
): Promise<WechatResponse> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`WeChat API request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as WechatResponse;
  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(
      data.errcode,
      `WeChat API error ${data.errcode}: ${data.errmsg ?? "unknown"}`
    );
  }

  return data;
}

function expiresAt(expiresIn = 7200) {
  const lifetimeMs = expiresIn * 1000;
  const safetyWindow = Math.min(
    CACHE_SAFETY_WINDOW_MS,
    Math.max(5_000, lifetimeMs * 0.1)
  );
  return Date.now() + Math.max(1_000, lifetimeMs - safetyWindow);
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && isFresh(accessTokenCache)) {
    return accessTokenCache!.value;
  }

  if (!forceRefresh && accessTokenRequest) {
    return (await accessTokenRequest).value;
  }

  const request = (async () => {
    const url = new URL(`${WECHAT_API_BASE}/stable_token`);
    const data = await fetchWechat(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: WECHAT_APP_ID,
        secret: WECHAT_APP_SECRET,
        force_refresh: forceRefresh,
      }),
    });
    if (!data.access_token) {
      throw new Error("WeChat API did not return an access token");
    }

    return {
      value: data.access_token,
      expiresAt: expiresAt(data.expires_in),
    };
  })();

  accessTokenRequest = request;

  try {
    accessTokenCache = await request;
    return accessTokenCache.value;
  } finally {
    if (accessTokenRequest === request) accessTokenRequest = undefined;
  }
}

async function requestTicket(accessToken: string): Promise<ExpiringValue> {
  const url = new URL(`${WECHAT_API_BASE}/ticket/getticket`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("type", "jsapi");

  const data = await fetchWechat(url);
  if (!data.ticket) {
    throw new Error("WeChat API did not return a JSAPI ticket");
  }

  return {
    value: data.ticket,
    expiresAt: expiresAt(data.expires_in),
  };
}

async function getJsapiTicket(): Promise<string> {
  if (isFresh(ticketCache)) return ticketCache!.value;
  if (ticketRequest) return (await ticketRequest).value;

  const request = (async () => {
    try {
      return await requestTicket(await getAccessToken());
    } catch (error) {
      const isInvalidToken =
        error instanceof WechatApiError &&
        [40001, 40014, 42001].includes(error.code);

      if (!isInvalidToken) throw error;

      // A serverless instance may retain a revoked token. Refresh it once before
      // surfacing the error; the API still controls the authoritative validity.
      accessTokenCache = undefined;
      return requestTicket(await getAccessToken(true));
    }
  })();

  ticketRequest = request;

  try {
    ticketCache = await request;
    return ticketCache.value;
  } finally {
    if (ticketRequest === request) ticketRequest = undefined;
  }
}

function getShareUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url");
  if (!rawUrl) throw new TypeError("Missing url parameter");
  if (rawUrl.length > 2_048) throw new TypeError("URL is too long");

  const shareUrl = new URL(rawUrl);
  shareUrl.hash = "";

  if (shareUrl.username || shareUrl.password) {
    throw new TypeError("URL credentials are not allowed");
  }

  const siteUrl = new URL(SITE.website);
  if (shareUrl.origin !== siteUrl.origin) {
    throw new TypeError("The URL is outside the configured site origin");
  }

  return shareUrl.href;
}

export const GET: APIRoute = async ({ request }) => {
  if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
    return json({ error: "WeChat sharing is not configured" }, 503);
  }

  let url: string;
  try {
    url = getShareUrl(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL";
    return json({ error: message }, 400);
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomBytes(16).toString("hex");
    const ticket = await getJsapiTicket();
    const source = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    const signature = createHash("sha1").update(source).digest("hex");

    return json({
      appId: WECHAT_APP_ID,
      nonceStr,
      signature,
      timestamp,
    });
  } catch (error) {
    console.error("Failed to create WeChat JS-SDK signature", error);
    return json({ error: "Unable to configure WeChat sharing" }, 502);
  }
};
