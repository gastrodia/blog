/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

const WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin";
const CACHE_SAFETY_WINDOW_MS = 5 * 60 * 1000;

let accessTokenCache;
let ticketCache;
let accessTokenRequest;
let ticketRequest;

class WechatApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "WechatApiError";
  }
}

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: body === undefined ? "" : JSON.stringify(body),
  };
}

function readConfig() {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  const signerToken = process.env.SIGNER_TOKEN?.trim();
  const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim();

  if (!appId || !appSecret || !signerToken || !allowedOrigin) {
    throw new Error("Required environment variables are missing");
  }

  const origin = new URL(allowedOrigin).origin;
  if (origin !== allowedOrigin.replace(/\/$/, "")) {
    throw new Error("ALLOWED_ORIGIN must contain only an HTTPS origin");
  }
  if (!origin.startsWith("https://")) {
    throw new Error("ALLOWED_ORIGIN must use HTTPS");
  }

  return { appId, appSecret, signerToken, allowedOrigin: origin };
}

function hasValidAuthorization(event, expectedToken) {
  const headers = event.headers || {};
  const authorization = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === "authorization"
  )?.[1];
  const actualToken =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getHttpMethod(event) {
  return (
    event.httpMethod || event.requestContext?.httpMethod || "GET"
  ).toUpperCase();
}

function getQueryParameter(event, name) {
  return event.queryString?.[name] ?? event.queryStringParameters?.[name];
}

function getShareUrl(event, allowedOrigin) {
  const rawUrl = getQueryParameter(event, "url");
  if (typeof rawUrl !== "string" || !rawUrl) {
    throw new TypeError("Missing url parameter");
  }
  if (rawUrl.length > 2048) throw new TypeError("URL is too long");

  const shareUrl = new URL(rawUrl);
  shareUrl.hash = "";

  if (shareUrl.username || shareUrl.password) {
    throw new TypeError("URL credentials are not allowed");
  }
  if (shareUrl.origin !== allowedOrigin) {
    throw new TypeError("The URL is outside the configured site origin");
  }

  return shareUrl.href;
}

function isFresh(entry) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function expiresAt(expiresIn = 7200) {
  const lifetimeMs = expiresIn * 1000;
  const safetyWindow = Math.min(
    CACHE_SAFETY_WINDOW_MS,
    Math.max(5000, lifetimeMs * 0.1)
  );
  return Date.now() + Math.max(1000, lifetimeMs - safetyWindow);
}

async function fetchWechat(url, init) {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const apiResponse = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(4000),
  });

  if (!apiResponse.ok) {
    throw new Error(`WeChat API request failed with HTTP ${apiResponse.status}`);
  }

  const data = await apiResponse.json();
  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(
      data.errcode,
      `WeChat API error ${data.errcode}: ${data.errmsg || "unknown"}`
    );
  }

  return data;
}

async function getAccessToken(config, forceRefresh = false) {
  if (!forceRefresh && isFresh(accessTokenCache)) {
    return accessTokenCache.value;
  }
  if (!forceRefresh && accessTokenRequest) {
    return (await accessTokenRequest).value;
  }

  const request = (async () => {
    const data = await fetchWechat(`${WECHAT_API_BASE}/stable_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.appSecret,
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

async function requestTicket(accessToken) {
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

async function getJsapiTicket(config) {
  if (isFresh(ticketCache)) return ticketCache.value;
  if (ticketRequest) return (await ticketRequest).value;

  const request = (async () => {
    try {
      return await requestTicket(await getAccessToken(config));
    } catch (error) {
      const isInvalidToken =
        error instanceof WechatApiError &&
        [40001, 40014, 42001].includes(error.code);
      if (!isInvalidToken) throw error;

      accessTokenCache = undefined;
      return requestTicket(await getAccessToken(config, true));
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

async function main_handler(event) {
  let config;
  try {
    config = readConfig();
  } catch (error) {
    console.error("Invalid WeChat signer configuration", error);
    return response(503, { error: "WeChat signing is not configured" });
  }

  const method = getHttpMethod(event);
  if (method !== "GET") {
    return response(
      405,
      { error: "Method not allowed" },
      { Allow: "GET" }
    );
  }

  if (!hasValidAuthorization(event, config.signerToken)) {
    return response(401, { error: "Unauthorized" });
  }

  let url;
  try {
    url = getShareUrl(event, config.allowedOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL";
    return response(400, { error: message });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomBytes(16).toString("hex");
    const ticket = await getJsapiTicket(config);
    const source = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    const signature = createHash("sha1").update(source).digest("hex");

    return response(200, {
      appId: config.appId,
      nonceStr,
      signature,
      timestamp,
    });
  } catch (error) {
    console.error("Failed to create WeChat JS-SDK signature", error);
    return response(502, { error: "Unable to configure WeChat sharing" });
  }
}

module.exports = { main_handler };
