import { GoogleGenAI } from "@google/genai";

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
