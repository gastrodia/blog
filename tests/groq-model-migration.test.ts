import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("runtime Groq calls share the GPT-OSS 120B model constant", () => {
  const config = read("src/lib/groq.ts");
  const chat = read("src/pages/api/chat.ts");
  const query = read("scripts/query-blog.ts");

  expect(config).toContain(
    'export const GROQ_CHAT_MODEL = "openai/gpt-oss-120b" as const;'
  );
  expect(chat).toContain('import { GROQ_CHAT_MODEL } from "@/lib/groq";');
  expect(query).toContain('import { GROQ_CHAT_MODEL } from "../src/lib/groq";');
  expect(chat.match(/model: GROQ_CHAT_MODEL/g)).toHaveLength(2);
  expect(query.match(/model: GROQ_CHAT_MODEL/g)).toHaveLength(1);
});

test("target runtime and article files no longer reference Llama 3.3", () => {
  const files = [
    "src/pages/api/chat.ts",
    "scripts/query-blog.ts",
    "src/data/blog/29.md",
  ].map(read);

  for (const content of files) {
    expect(content).not.toContain("llama-3.3-70b-versatile");
  }
  expect(files[2]).toContain("openai/gpt-oss-120b");
});
