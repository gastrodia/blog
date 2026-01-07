// src/pages/api/chat.ts
import type { APIRoute } from "astro";
import { sql } from "@vercel/postgres";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

// 标记为服务器端渲染（必需）
export const prerender = false;

// RAG 聊天 API - 支持流式响应和上下文
// 流程：问题 → [Gemini转向量] → 向量搜索 → [Groq流式生成] → SSE 返回

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

interface SearchResult {
  title: string;
  source: string;
  text: string;
  similarity: number;
}

// 将问题转换为向量
async function getQueryEmbedding(
  geminiKey: string,
  query: string
): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(query);
  return result.embedding.values;
}

// 向量搜索相似文档
async function searchSimilarDocs(
  embedding: number[],
  topK: number = 3
): Promise<SearchResult[]> {
  const embeddingString = JSON.stringify(embedding);

  const results = await sql`
    SELECT 
      title, 
      source, 
      text,
      1 - (embedding <=> ${embeddingString}::vector) as similarity
    FROM blog_embeddings
    ORDER BY embedding <=> ${embeddingString}::vector
    LIMIT ${topK}
  `;

  return results.rows.map((row) => ({
    title: row.title as string,
    source: row.source as string,
    text: (row.text as string).substring(0, 1500), // 限制长度
    similarity: row.similarity as number,
  }));
}

// 构建 Prompt（包含历史上下文）
function buildPrompt(
  question: string,
  context: SearchResult[],
  history?: ChatMessage[]
): { system: string; messages: { role: string; content: string }[] } {
  // 系统提示词
  const systemPrompt = `你是 Code_You 博客的智能助手，专门回答关于博客内容的问题。

**你的职责：**
1. 基于提供的博客文档内容准确回答问题
2. 如果文档中没有相关信息，诚实告知用户
3. 回答要简洁、有帮助、友好
4. 可以适当结合上下文对话历史
5. 使用中文回答

**注意事项：**
- 不要编造不存在的内容
- 如果不确定，建议用户查看原文
- 回答时可以引用文档标题`;

  // 构建上下文文本
  const contextText = context
    .map((doc, idx) => `【文档 ${idx + 1}：${doc.title}】\n${doc.text}`)
    .join("\n\n---\n\n");

  // 构建消息历史
  const messages: { role: string; content: string }[] = [];

  // 添加历史对话（最近 5 轮，避免 token 过多）
  if (history && history.length > 0) {
    const recentHistory = history.slice(-10); // 保留最近 10 条消息（5轮对话）
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });
  }

  // 添加当前问题
  messages.push({
    role: "user",
    content: `基于以下博客内容回答我的问题：

${contextText}

---

我的问题：${question}`,
  });

  return { system: systemPrompt, messages };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 检查请求体是否存在
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("无效的 Content-Type:", contentType);
      return new Response(
        JSON.stringify({ error: "请求必须是 JSON 格式" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 读取请求体
    const text = await request.text();
    console.log("收到请求体:", text);

    if (!text || text.trim() === "") {
      console.error("请求体为空");
      return new Response(
        JSON.stringify({ error: "请求体不能为空" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 解析 JSON
    let body: ChatRequest;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON 解析错误:", parseError);
      return new Response(
        JSON.stringify({ error: "JSON 格式错误: " + (parseError instanceof Error ? parseError.message : "未知错误") }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "缺少消息内容" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 获取环境变量
    const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY;
    const GROQ_API_KEY = import.meta.env.GROQ_API_KEY;
    const POSTGRES_URL = import.meta.env.POSTGRES_URL;

    if (!GEMINI_API_KEY || !GROQ_API_KEY || !POSTGRES_URL) {
      console.error("环境变量未配置:", {
        hasGemini: !!GEMINI_API_KEY,
        hasGroq: !!GROQ_API_KEY,
        hasPostgres: !!POSTGRES_URL,
      });
      return new Response(
        JSON.stringify({ error: "服务配置错误，请联系管理员" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 设置 POSTGRES_URL 到 process.env（@vercel/postgres 需要）
    process.env.POSTGRES_URL = POSTGRES_URL;

    // 1. 将问题转为向量
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getQueryEmbedding(GEMINI_API_KEY, message);
    } catch (error) {
      console.error("向量化失败:", error);
      return new Response(
        JSON.stringify({ error: "处理问题时出错，请稍后重试" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. 搜索相似文档
    let similarDocs: SearchResult[];
    try {
      similarDocs = await searchSimilarDocs(queryEmbedding, 3);
    } catch (error) {
      console.error("搜索文档失败:", error);
      return new Response(
        JSON.stringify({ error: "搜索相关内容时出错，请稍后重试" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 如果没有找到相关内容
    if (similarDocs.length === 0) {
      const fallbackResponse = JSON.stringify({
        type: "message",
        content: "抱歉，我在博客中没有找到相关的内容来回答你的问题。你可以尝试换个方式提问，或者直接浏览博客文章。",
        sources: [],
      });

      return new Response(fallbackResponse, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. 构建 Prompt
    let promptData: { system: string; messages: { role: string; content: string }[] };
    try {
      promptData = buildPrompt(message, similarDocs, history);
    } catch (error) {
      console.error("构建 Prompt 失败:", error);
      return new Response(
        JSON.stringify({ error: "处理对话历史时出错" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. 使用 Groq 流式生成回答
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    let stream;
    try {
      stream = await groq.chat.completions.create({
        messages: [
          { role: "system", content: promptData.system },
          ...promptData.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1024,
        stream: true, // 启用流式响应
      });
    } catch (error) {
      console.error("Groq API 调用失败:", error);
      return new Response(
        JSON.stringify({ 
          error: error instanceof Error ? error.message : "AI 生成回答时出错" 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 创建 Server-Sent Events 流
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 先发送数据来源
          const sourcesData = JSON.stringify({
            type: "sources",
            sources: similarDocs.map((doc) => ({
              title: doc.title,
              source: doc.source,
              similarity: Math.round(doc.similarity * 100),
            })),
          });
          controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`));

          // 流式发送 AI 回复
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              const data = JSON.stringify({
                type: "content",
                content,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 发送完成信号
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errorData = JSON.stringify({
            type: "error",
            error: "生成回答时出错",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API 未捕获的错误:", error);
    
    // 确保返回有效的 JSON
    const errorMessage = error instanceof Error ? error.message : "服务器内部错误";
    const errorResponse = {
      error: errorMessage,
      details: error instanceof Error ? error.stack : String(error),
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
