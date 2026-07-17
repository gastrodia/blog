import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedQuery,
  embedDocument,
  embedDocuments,
  prepareEmbeddingDocument,
  prepareEmbeddingQuery,
} from "../src/lib/gemini-embedding";

const root = join(import.meta.dir, "..");

test("uses the supported Gemini embedding model across indexing and queries", () => {
  const helperPath = join(root, "src", "lib", "gemini-embedding.ts");
  expect(existsSync(helperPath)).toBe(true);

  const helper = readFileSync(helperPath, "utf8");
  const packageJson = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8")
  );
  const runtimeFiles = [
    "src/pages/api/chat.ts",
    "scripts/index-blog.ts",
    "scripts/query-blog.ts",
  ].map(path => readFileSync(join(root, path), "utf8"));

  expect(packageJson.dependencies["@google/genai"]).toBeDefined();
  expect(packageJson.dependencies["@google/generative-ai"]).toBeUndefined();
  expect(helper).toContain('EMBEDDING_MODEL = "gemini-embedding-2"');
  expect(helper).toContain("outputDimensionality: EMBEDDING_DIMENSIONS");
  expect(runtimeFiles.join("\n")).not.toContain("text-embedding-004");
  expect(runtimeFiles.join("\n")).not.toContain("@google/generative-ai");
});

test("re-indexes unchanged documents when the embedding model changes", () => {
  const indexScript = readFileSync(join(root, "scripts/index-blog.ts"), "utf8");

  expect(indexScript).toContain("embedding_model TEXT");
  expect(indexScript).toContain("embedding_model = EXCLUDED.embedding_model");
  expect(indexScript).toContain(
    "existing.rows[0].embedding_model === EMBEDDING_VERSION"
  );
});

test("uses an isolated v2 table and filters every vector search by compatibility", () => {
  const chat = readFileSync(join(root, "src/pages/api/chat.ts"), "utf8");
  const indexScript = readFileSync(join(root, "scripts/index-blog.ts"), "utf8");
  const queryScript = readFileSync(join(root, "scripts/query-blog.ts"), "utf8");

  expect(indexScript).toContain("CREATE TABLE IF NOT EXISTS blog_embeddings_v2");
  expect(indexScript).toContain("BEGIN");
  expect(indexScript).toContain("COMMIT");
  expect(indexScript).not.toContain("USING ivfflat");
  expect(chat).toContain("to_regclass('public.blog_embeddings_v2')");
  expect(chat).toContain("FROM blog_embeddings_v2");
  expect(chat).toContain("embedding_model = ${EMBEDDING_VERSION}");
  expect(queryScript).toContain("FROM blog_embeddings_v2");
  expect(queryScript).toContain("embedding_model = ${EMBEDDING_VERSION}");
});

test("embedding changes trigger indexing without a commit-message convention", () => {
  const workflow = readFileSync(
    join(root, ".github/workflows/index-blog.yml"),
    "utf8"
  );

  expect(workflow).toContain('"src/lib/gemini-embedding.ts"');
  expect(workflow).toContain('"scripts/index-blog.ts"');
  expect(workflow).toContain('"package.json"');
  expect(workflow).not.toContain("startsWith(github.event.head_commit.message");
  expect(workflow).toContain("cancel-in-progress: true");
});

test("indexes changed documents in bounded, resumable batches", () => {
  const indexScript = readFileSync(join(root, "scripts/index-blog.ts"), "utf8");

  expect(indexScript).toContain("const EMBEDDING_BATCH_SIZE = 10");
  expect(indexScript).toContain("start += EMBEDDING_BATCH_SIZE");
  expect(indexScript).toContain("await embedDocuments(");
  expect(indexScript).toMatch(
    /await storeEmbeddings\(\s*batchDocuments,\s*batchEmbeddings\s*\)/
  );
  expect(indexScript).not.toContain("processedCount % 10");

  const batchLoop = indexScript.indexOf("start += EMBEDDING_BATCH_SIZE");
  const batchEmbedding = indexScript.indexOf("await embedDocuments(", batchLoop);
  const batchPersistence = indexScript.indexOf(
    "await storeEmbeddings(",
    batchEmbedding
  );
  const cleanup = indexScript.indexOf("await cleanupDeletedDocuments(");

  expect(batchLoop).toBeGreaterThan(-1);
  expect(batchEmbedding).toBeGreaterThan(batchLoop);
  expect(batchPersistence).toBeGreaterThan(batchEmbedding);
  expect(cleanup).toBeGreaterThan(batchPersistence);
});

test("formats asymmetric question-answering inputs for Gemini Embedding 2", () => {
  expect(prepareEmbeddingQuery("作者是谁？")).toBe(
    "task: question answering | query: 作者是谁？"
  );
  expect(prepareEmbeddingDocument("正文", "标题")).toBe(
    "title: 标题 | text: 正文"
  );
});

test("requests a 768-dimensional query embedding", async () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  let received: unknown;
  const client = {
    models: {
      embedContent: async (params: unknown) => {
        received = params;
        return { embeddings: [{ values }] };
      },
    },
  };

  const result = await embedQuery(client as never, "测试问题");

  expect(received).toEqual({
    model: EMBEDDING_MODEL,
    contents: "task: question answering | query: 测试问题",
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  expect(result).toBe(values);
});

test("requests a 768-dimensional document embedding", async () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  let received: unknown;
  const client = {
    models: {
      embedContent: async (params: unknown) => {
        received = params;
        return { embeddings: [{ values }] };
      },
    },
  };

  await embedDocument(client as never, "正文", "标题");

  expect(received).toEqual({
    model: EMBEDDING_MODEL,
    contents: "title: 标题 | text: 正文",
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
});

test("embeds multiple documents in one request and preserves their order", async () => {
  const first = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);
  const second = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 2);
  let received: unknown;
  const client = {
    models: {
      embedContent: async (params: unknown) => {
        received = params;
        return { embeddings: [{ values: first }, { values: second }] };
      },
    },
  };

  const result = await embedDocuments(client as never, [
    { text: "正文一", title: "标题一" },
    { text: "正文二", title: "标题二" },
  ]);

  expect(received).toEqual({
    model: EMBEDDING_MODEL,
    contents: [
      { parts: [{ text: "title: 标题一 | text: 正文一" }] },
      { parts: [{ text: "title: 标题二 | text: 正文二" }] },
    ],
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  expect(result).toEqual([first, second]);
});

test("retries transient batch embedding failures", async () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);
  const quotaError = Object.assign(new Error("quota"), { status: 429 });
  let attempts = 0;

  const client = {
    models: {
      embedContent: async () => {
        attempts++;
        if (attempts === 1) throw quotaError;
        return { embeddings: [{ values }] };
      },
    },
  };

  await embedDocuments(
    client as never,
    [{ text: "正文", title: "标题" }],
    { sleep: async () => {}, random: () => 0 }
  );

  expect(attempts).toBe(2);
});

test("rejects incomplete batch embedding responses", async () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);
  const client = {
    models: {
      embedContent: async () => ({ embeddings: [{ values }] }),
    },
  };

  let received: unknown;
  try {
    await embedDocuments(client as never, [
      { text: "正文一" },
      { text: "正文二" },
    ]);
  } catch (error) {
    received = error;
  }

  expect(received).toBeInstanceOf(Error);
  expect((received as Error).message).toContain("期望 2 个向量，实际 1 个");
});
