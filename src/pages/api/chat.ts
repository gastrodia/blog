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
  mode?: "chat" | "summary";
  postId?: string;
}

interface SearchResult {
  title: string;
  source: string;
  description: string;
  text: string;
  similarity: number;
}

// 将问题转换为向量（与索引时使用相同的模型）
async function getQueryEmbedding(
  geminiKey: string,
  query: string
): Promise<number[]> {
  console.log(`🔍 正在将问题转换为向量: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(query);
  console.log(`✅ 向量维度: ${result.embedding.values.length}`);
  return result.embedding.values;
}

// 向量搜索相似文档（优化：进一步降低阈值）
async function searchSimilarDocs(
  embedding: number[],
  topK: number = 5, // 返回前5个结果
  minSimilarity: number = 0.25 // 进一步降低阈值到0.25（25%）
): Promise<SearchResult[]> {
  const embeddingString = JSON.stringify(embedding);

  // 先获取所有结果看看相似度分布
  const allResults = await sql`
    SELECT 
      title, 
      source, 
      text,
      description,
      1 - (embedding <=> ${embeddingString}::vector) as similarity
    FROM blog_embeddings
    ORDER BY embedding <=> ${embeddingString}::vector
    LIMIT 10
  `;

  // 打印前10个结果的相似度，用于调试
  console.log("📊 相似度排名（前10）:");
  allResults.rows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.title}: ${((row.similarity as number) * 100).toFixed(2)}%`);
  });

  // 过滤出符合阈值的结果
  const filteredResults = allResults.rows
    .filter((row) => (row.similarity as number) >= minSimilarity)
    .slice(0, topK);

  console.log(`✅ 返回 ${filteredResults.length} 个结果（相似度 >= ${minSimilarity * 100}%）`);

  return filteredResults.map((row) => ({
    title: row.title as string,
    source: row.source as string,
    description: (row.description as string) || "",
    text: (row.text as string).substring(0, 2000), // 增加长度到2000
    similarity: row.similarity as number,
  }));
}

function truncateForSummary(text: string, maxChars: number = 16000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.75));
  const tail = text.slice(-Math.floor(maxChars * 0.25));
  return `${head}\n\n...[内容过长，已截断]...\n\n${tail}`;
}

async function getDocById(id: string) {
  const rows = await sql`
    SELECT id, title, source, description, text
    FROM blog_embeddings
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows.rows?.[0] as
    | {
        id: string;
        title: string;
        source: string;
        description: string | null;
        text: string;
      }
    | undefined;
}

// 构建 Prompt（包含历史上下文）
function buildPrompt(
  question: string,
  context: SearchResult[],
  history?: ChatMessage[]
): { system: string; messages: { role: string; content: string }[] } {
  // 系统提示词 - 优化：平衡准确性和可用性
  const systemPrompt = `你是 Code_You 博客的智能助手，专门回答关于博客内容和作者信息的问题。

**交互原则：**
1. 【智能识别意图】
   - 如果是简单问候（如"你好"、"在吗"），友好回应并简短引导
   - 如果是感谢/告别，自然礼貌回应
   - 如果是关于博客/作者的实际问题，基于文档认真详细回答

2. 【回答实际问题时的核心原则】
   - ✅ **优先使用文档内容**：文档中的信息一定要回答
   - ✅ **理解语义相关性**：即使问法不同，只要文档内容相关就要回答
   - ✅ **完整提取信息**：从文档中提取所有相关信息进行回答
   - ✅ **自然融入来源**：用口语化方式提及来源，如"根据资料..."、"作者介绍..."
   - ⚠️ **只在真正没有相关内容时**才说"文档中没有提到"

3. 【语义理解要求】（重要！）
   - "关于作者的信息" = 作者简介、个人信息、教育背景、联系方式等
   - "技能栈/技术栈" = 掌握的编程语言、框架、工具等
   - "项目/作品集/开发项目" = 实际开发的项目作品（不是博客文章！）
   - "博客文章/文章" = 发表的文章内容（不是项目作品！）
   - **问题和文档标题不完全一致是正常的**，要理解语义相关性
   - **重要区分**：项目作品 ≠ 博客文章，要根据文档类型准确回答

4. 【回答风格要求】
   - 对问候/闲聊：简短自然
   - 对实际问题：**详细全面**，把文档中的相关信息都整理出来
   - 保持友好、专业、自然的语气
   - 使用中文回答

**引用来源的正确方式：**
✅ "根据资料显示..."
✅ "作者的信息是..."  
✅ "从介绍中可以看到..."
✅ 或者直接回答内容

**重要提醒：**
✅ 如果文档中有相关信息，**一定要回答**，不要因为措辞不同就说没有
✅ 从文档中提取信息时要**完整全面**，不要遗漏重要内容
❌ 不要添加文档中完全没有的信息
❌ 不要使用生硬的格式标注`;

  // 构建上下文文本（包含标题、描述和正文）
  const contextText = context
    .map((doc, idx) => {
      const parts = [`【文档 ${idx + 1}：${doc.title}】`];
      if (doc.description) {
        parts.push(`简介：${doc.description}`);
      }
      parts.push(`\n${doc.text}`);
      return parts.join("\n");
    })
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

  // 添加当前问题 - 优化指引
  messages.push({
    role: "user",
    content: `${contextText ? `===== 检索到的相关文档 =====\n${contextText}\n===== 文档结束 =====\n\n` : ''}【用户问题】${question}

【回答指引】
- 如果是问候/闲聊：自然友好地回应
- 如果是实际问题：
  * ✅ **仔细阅读上述文档**，理解问题和文档内容的语义关联
  * ✅ **如果文档中有相关信息，一定要详细回答**，不要因为措辞不同就说没有
  * ✅ **重要区分**：
    - 问"项目/作品"时 → 找标注为"开发项目"的文档，不要回答博客文章
    - 问"博客/文章"时 → 找标注为"博客文章"的文档，不要回答项目
  * ✅ 例如：问"关于作者的信息"时，【关于作者个人信息】文档就是相关的
  * ✅ 例如：问"有哪些项目"时，【开发项目列表】文档才是答案，不是博客文章标题
  * ✅ 从文档中提取完整信息，用自然流畅的语言表达
  * ✅ 可以说"根据资料..."、"作者介绍..."等自然引导
  * ❌ 只有文档内容**完全无关**时才说"文档中没有提到"
  * ❌ 不要添加文档中没有的信息
  * ❌ 不要混淆项目和博客文章`,
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

    const { message, history, mode = "chat", postId } = body;

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

    // summary 模式不需要 Gemini embedding，但需要 Groq + Postgres
    const hasRequiredEnv =
      mode === "summary"
        ? !!GROQ_API_KEY && !!POSTGRES_URL
        : !!GEMINI_API_KEY && !!GROQ_API_KEY && !!POSTGRES_URL;

    if (!hasRequiredEnv) {
      console.error("环境变量未配置:", {
        mode,
        hasGemini: !!GEMINI_API_KEY,
        hasGroq: !!GROQ_API_KEY,
        hasPostgres: !!POSTGRES_URL,
      });
      return new Response(JSON.stringify({ error: "服务配置错误，请联系管理员" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 设置 POSTGRES_URL 到 process.env（@vercel/postgres 需要）
    process.env.POSTGRES_URL = POSTGRES_URL;

    // ========== 文章总结模式：按 id 取全文，直接总结（不走 RAG） ==========
    if (mode === "summary") {
      if (!postId || typeof postId !== "string") {
        return new Response(JSON.stringify({ error: "缺少 postId，无法总结文章" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const doc = await getDocById(postId);
      if (!doc) {
        return new Response(JSON.stringify({ error: `未找到文章内容（id=${postId}）` }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const summarySystemPrompt = `你是 Code_You 博客的智能助手。请用中文对“当前文章”做一个结构化总结。

要求：
- 先给 1 句 TL;DR
- 再给 5-10 条要点（用列表）
- 如果文章包含代码/步骤/结论，请提炼关键点
- 如果是代码/教程类文章：可以给出 1-3 段“核心代码片段”（尽量短小、关键、可复制），不要粘贴大段无关代码
- 不要编造文章中不存在的信息
- 输出尽量精炼但覆盖主要内容`;

      const articleText = truncateForSummary(doc.text, 16000);
      const summaryUserPrompt = `【文章标题】${doc.title}
${doc.description ? `【文章简介】${doc.description}\n` : ""}【文章正文】
${articleText}`;

      const groq = new Groq({ apiKey: GROQ_API_KEY! });
      const stream = await groq.chat.completions.create({
        messages: [
          { role: "system", content: summarySystemPrompt },
          { role: "user", content: summaryUserPrompt },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 1024,
        top_p: 0.9,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                const data = JSON.stringify({ type: "content", content });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
            );
            controller.close();
          } catch (error) {
            console.error("Summary stream error:", error);
            const errorData = JSON.stringify({
              type: "error",
              error: "生成总结时出错",
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
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "服务配置错误，请联系管理员" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    // 2. 搜索相似文档（使用优化后的阈值）
    let similarDocs: SearchResult[];
    try {
      // 使用默认参数：topK=5, minSimilarity=0.3
      similarDocs = await searchSimilarDocs(queryEmbedding);
      console.log(`✅ 找到 ${similarDocs.length} 个相关文档`);
      if (similarDocs.length > 0) {
        console.log("📄 相关文档:", 
          similarDocs.map(d => `${d.title} (${(d.similarity * 100).toFixed(1)}%)`).join(", "));
      }
    } catch (error) {
      console.error("❌ 搜索文档失败:", error);
      return new Response(
        JSON.stringify({ error: "搜索相关内容时出错，请稍后重试" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 如果没有找到相关内容，让模型自己回答（可能是问候或无关问题）
    // 不立即返回，而是传递空上下文让模型处理
    console.log(similarDocs.length === 0 ? '未找到相关文档，让模型自由回答' : `找到 ${similarDocs.length} 个相关文档`);

    // 3. 构建 Prompt（即使没有文档也继续，让模型处理问候等情况）
    let promptData: { system: string; messages: { role: string; content: string }[] };
    try {
      // 如果没有文档，传递空数组
      promptData = buildPrompt(message, similarDocs.length > 0 ? similarDocs : [], history);
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
        temperature: 0.3, // 降低温度以减少幻觉（从 0.7 降至 0.3）
        max_tokens: 1024,
        top_p: 0.9, // 添加 top_p 以进一步控制随机性
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
          // 先发送数据来源（只有找到文档时才发送）
          if (similarDocs.length > 0) {
            const sourcesData = JSON.stringify({
              type: "sources",
              sources: similarDocs.map((doc) => ({
                title: doc.title,
                source: doc.source,
                similarity: Math.round(doc.similarity * 100),
              })),
            });
            controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`));
          }

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
