import { GoogleGenAI } from "@google/genai";
import { retryTransient, type RetryOptions } from "./retry";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;
export const EMBEDDING_VERSION = `${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:question-answering-v1`;

export function prepareEmbeddingQuery(query: string): string {
  return `task: question answering | query: ${query}`;
}

export function prepareEmbeddingDocument(text: string, title?: string): string {
  return `title: ${title || "none"} | text: ${text}`;
}

export async function embedQuery(
  client: GoogleGenAI,
  query: string
): Promise<number[]> {
  return embedContent(client, prepareEmbeddingQuery(query));
}

export async function embedDocument(
  client: GoogleGenAI,
  text: string,
  title?: string
): Promise<number[]> {
  return embedContent(client, prepareEmbeddingDocument(text, title));
}

export interface EmbeddingDocument {
  text: string;
  title?: string;
}

export async function embedDocuments(
  client: GoogleGenAI,
  documents: EmbeddingDocument[],
  retryOptions: RetryOptions = {}
): Promise<number[][]> {
  if (documents.length === 0) return [];

  const response = await retryTransient(
    () =>
      client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: documents.map(document => ({
          parts: [
            { text: prepareEmbeddingDocument(document.text, document.title) },
          ],
        })),
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    {
      ...retryOptions,
      onRetry:
        retryOptions.onRetry ??
        ((error, retryNumber, delayMs) => {
          const status =
            error && typeof error === "object" && "status" in error
              ? String(error.status)
              : "unknown";
          console.warn(
            `  ⚠️  Gemini 暂时不可用（HTTP ${status}），${delayMs}ms 后进行第 ${retryNumber} 次重试...`
          );
        }),
    }
  );

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== documents.length) {
    throw new Error(
      `Gemini 返回了不完整的批量结果，期望 ${documents.length} 个向量，实际 ${embeddings.length} 个`
    );
  }

  return embeddings.map((embedding, index) => {
    const values = embedding.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Gemini 第 ${index + 1} 个向量无效，期望 ${EMBEDDING_DIMENSIONS} 维，实际 ${values?.length ?? 0} 维`
      );
    }
    return values;
  });
}

async function embedContent(
  client: GoogleGenAI,
  contents: string
): Promise<number[]> {
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;

  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Gemini 返回了无效向量，期望 ${EMBEDDING_DIMENSIONS} 维，实际 ${values?.length ?? 0} 维`
    );
  }

  return values;
}
