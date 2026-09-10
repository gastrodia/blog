import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

interface ScfResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface ScfModule {
  main_handler(event: Record<string, unknown>): Promise<ScfResponse>;
}

const require = createRequire(import.meta.url);
const modulePath = resolve(
  import.meta.dir,
  "../scf/wechat-signature/index.js"
);
const originalFetch = globalThis.fetch;

function loadFunction(): ScfModule {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath) as ScfModule;
}

beforeEach(() => {
  process.env.WECHAT_APP_ID = "wx-test";
  process.env.WECHAT_APP_SECRET = "secret";
  process.env.ALLOWED_ORIGIN = "https://jiajiwei.top";
  process.env.SIGNER_TOKEN = "signer-token";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.WECHAT_APP_ID;
  delete process.env.WECHAT_APP_SECRET;
  delete process.env.ALLOWED_ORIGIN;
  delete process.env.SIGNER_TOKEN;
});

test("rejects requests without the Vercel signer token", async () => {
  const signer = loadFunction();
  const result = await signer.main_handler({
    httpMethod: "GET",
    headers: {},
    queryString: { url: "https://jiajiwei.top/posts/p31" },
  });

  expect(result.statusCode).toBe(401);
  expect(JSON.parse(result.body)).toEqual({ error: "Unauthorized" });
});

test("rejects signing URLs outside the configured blog origin", async () => {
  const signer = loadFunction();
  const result = await signer.main_handler({
    httpMethod: "GET",
    headers: { authorization: "Bearer signer-token" },
    queryString: { url: "https://example.com/posts/p31" },
  });

  expect(result.statusCode).toBe(400);
  expect(JSON.parse(result.body)).toEqual({
    error: "The URL is outside the configured site origin",
  });
});

test("creates a valid signature and caches WeChat credentials", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = input.toString();
    requests.push({ url, init });

    if (url.endsWith("/stable_token")) {
      return Response.json({ access_token: "access-token", expires_in: 7200 });
    }
    if (url.includes("/ticket/getticket")) {
      return Response.json({ ticket: "jsapi-ticket", expires_in: 7200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const signer = loadFunction();
  const event = {
    httpMethod: "GET",
    headers: { Authorization: "Bearer signer-token" },
    queryString: { url: "https://jiajiwei.top/posts/p31#comments" },
  };

  const first = await signer.main_handler(event);
  const second = await signer.main_handler(event);
  const body = JSON.parse(first.body) as {
    appId: string;
    nonceStr: string;
    signature: string;
    timestamp: number;
  };

  const source = `jsapi_ticket=jsapi-ticket&noncestr=${body.nonceStr}&timestamp=${body.timestamp}&url=https://jiajiwei.top/posts/p31`;
  expect(first.statusCode).toBe(200);
  expect(second.statusCode).toBe(200);
  expect(body.appId).toBe("wx-test");
  expect(body.signature).toBe(createHash("sha1").update(source).digest("hex"));
  expect(requests).toHaveLength(2);
  expect(requests[0]?.url).toEndWith("/stable_token");
  expect(requests[1]?.url).toContain(
    "/ticket/getticket?access_token=access-token&type=jsapi"
  );
});
