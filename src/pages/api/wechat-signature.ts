import type { APIRoute } from "astro";
import { WECHAT_SIGNER_TOKEN, WECHAT_SIGNER_URL } from "astro:env/server";
import { SITE } from "@/config";

export const prerender = false;

interface WechatSignature {
  appId: string;
  nonceStr: string;
  signature: string;
  timestamp: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
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

function isWechatSignature(value: unknown): value is WechatSignature {
  if (!value || typeof value !== "object") return false;

  const config = value as Partial<WechatSignature>;
  return (
    typeof config.appId === "string" &&
    typeof config.nonceStr === "string" &&
    typeof config.timestamp === "number" &&
    typeof config.signature === "string" &&
    /^[a-f0-9]{40}$/i.test(config.signature)
  );
}

export const GET: APIRoute = async ({ request }) => {
  if (!WECHAT_SIGNER_URL || !WECHAT_SIGNER_TOKEN) {
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
    const signerUrl = new URL(WECHAT_SIGNER_URL);
    if (signerUrl.protocol !== "https:") {
      throw new Error("The WeChat signer URL must use HTTPS");
    }
    signerUrl.searchParams.set("url", url);

    const response = await fetch(signerUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${WECHAT_SIGNER_TOKEN}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `WeChat signer request failed with HTTP ${response.status}`
      );
      return json({ error: "Unable to configure WeChat sharing" }, 502);
    }

    const config: unknown = await response.json();
    if (!isWechatSignature(config)) {
      throw new Error("The WeChat signer returned an invalid response");
    }

    return json(config);
  } catch (error) {
    console.error("Failed to request a WeChat JS-SDK signature", error);
    return json({ error: "Unable to configure WeChat sharing" }, 502);
  }
};
