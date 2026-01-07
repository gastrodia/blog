// scripts/query-blog.ts

import { sql } from "@vercel/postgres";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

// RAG（检索增强生成）问答系统
// 
// 🔍 为什么需要两个 API？
// 
// 1. Gemini Embedding API：
//    - 作用：将用户问题转换为 768 维向量
//    - 原因：必须使用与索引时相同的 embedding 模型（text-embedding-004）
//    - 只有相同模型生成的向量才能在同一向量空间中比较相似度
// 
// 2. Groq LLM API：
//    - 作用：根据检索到的文档生成自然语言回答
//    - 优势：速度超快（比 Gemini LLM 快 5-10 倍）、免费额度大
//    - 可替换为其他 LLM（如 Gemini、Claude、OpenAI）
// 
// 流程：问题 → [Gemini转向量] → 向量搜索 → [Groq生成答案] → 返回

interface SearchResult {
  id: string;
  title: string;
  source: string;
  text: string;
  similarity: number;
}

class BlogRAG {
  private geminiClient: GoogleGenerativeAI;
  private groqClient: Groq;
  private embeddingModel: string;

  constructor(geminiKey: string, groqKey: string) {
    this.geminiClient = new GoogleGenerativeAI(geminiKey);
    this.groqClient = new Groq({ apiKey: groqKey });
    this.embeddingModel = "text-embedding-004";
  }

  // 将用户问题转换为向量
  async getQueryEmbedding(query: string): Promise<number[]> {
    const model = this.geminiClient.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent(query);
    return result.embedding.values;
  }

  // 在数据库中搜索最相关的文档（使用余弦相似度）
  async searchSimilarDocuments(
    queryEmbedding: number[],
    topK: number = 3
  ): Promise<SearchResult[]> {
    const embeddingString = JSON.stringify(queryEmbedding);
    
    // 使用 pgvector 的余弦相似度搜索
    const results = await sql`
      SELECT 
        id, 
        title, 
        source, 
        text,
        1 - (embedding <=> ${embeddingString}::vector) as similarity
      FROM blog_embeddings
      ORDER BY embedding <=> ${embeddingString}::vector
      LIMIT ${topK}
    `;

    return results.rows as SearchResult[];
  }

  // 使用 Groq 生成回答
  async generateAnswer(
    question: string,
    context: SearchResult[]
  ): Promise<string> {
    // 构建上下文
    const contextText = context
      .map((doc, idx) => {
        // 截断文本避免超出 token 限制
        const truncatedText = doc.text.length > 1000 
          ? doc.text.substring(0, 1000) + "..." 
          : doc.text;
        return `【文档 ${idx + 1}：${doc.title}】\n${truncatedText}`;
      })
      .join("\n\n---\n\n");

    // 构建 prompt
    const systemPrompt = `你是一个博客助手，专门回答关于博客内容的问题。
请基于提供的博客文档内容来回答用户的问题。
如果文档中没有相关信息，请如实告知，不要编造内容。
回答要准确、简洁、有帮助。`;

    const userPrompt = `基于以下博客内容回答问题：

${contextText}

---

用户问题：${question}

请提供准确、有帮助的回答：`;

    // 调用 Groq（使用 llama3 等模型，速度超快）
    const completion = await this.groqClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile", // 或 "mixtral-8x7b-32768"
      temperature: 0.7,
      max_tokens: 1024,
    });

    return completion.choices[0]?.message?.content || "无法生成回答";
  }

  // 完整的问答流程
  async query(question: string, topK: number = 3): Promise<{
    answer: string;
    sources: SearchResult[];
  }> {
    console.log(`\n🔍 正在搜索相关内容...`);
    
    // 1. 将问题转换为向量
    const queryEmbedding = await this.getQueryEmbedding(question);
    
    // 2. 搜索相似文档
    const similarDocs = await this.searchSimilarDocuments(queryEmbedding, topK);
    
    console.log(`\n📚 找到 ${similarDocs.length} 篇相关文章：`);
    similarDocs.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.title} (相似度: ${(doc.similarity * 100).toFixed(1)}%)`);
    });
    
    // 3. 使用 Groq 生成回答
    console.log(`\n🤖 正在生成回答（使用 Groq）...`);
    const answer = await this.generateAnswer(question, similarDocs);
    
    return { answer, sources: similarDocs };
  }
}

// 交互式问答
async function interactiveMode(rag: BlogRAG) {
  console.log("\n💬 进入交互模式（输入 'exit' 或 'quit' 退出）\n");
  
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question("❓ 你的问题：", async (question: string) => {
      if (question.toLowerCase() === "exit" || question.toLowerCase() === "quit") {
        console.log("\n👋 再见！");
        rl.close();
        process.exit(0);
      }

      if (!question.trim()) {
        askQuestion();
        return;
      }

      try {
        const result = await rag.query(question);
        
        console.log("\n" + "=".repeat(60));
        console.log("✨ 回答：");
        console.log(result.answer);
        console.log("=".repeat(60));
        
        console.log("\n📖 参考来源：");
        result.sources.forEach((source, idx) => {
          console.log(`  ${idx + 1}. ${source.source} (${source.title})`);
        });
        console.log();
        
        askQuestion();
      } catch (error) {
        console.error("\n❌ 查询出错：", error);
        askQuestion();
      }
    });
  };

  askQuestion();
}

async function main() {
  console.log("🚀 博客 AI 问答系统（基于 RAG）");
  console.log("📦 技术栈：Gemini Embedding + Neon PostgreSQL + Groq");

  // 检查环境变量
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? Bun.env.GEMINI_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY ?? Bun.env.GROQ_API_KEY;
  const POSTGRES_URL = process.env.POSTGRES_URL ?? Bun.env.POSTGRES_URL;

  if (!GEMINI_API_KEY) {
    console.error("❌ 缺少 GEMINI_API_KEY 环境变量");
    process.exit(1);
  }

  if (!GROQ_API_KEY) {
    console.error("❌ 缺少 GROQ_API_KEY 环境变量");
    console.error("💡 获取免费 API Key：https://console.groq.com/keys");
    console.error("💡 然后在 .env.local 添加：GROQ_API_KEY=你的密钥");
    process.exit(1);
  }

  if (!POSTGRES_URL) {
    console.error("❌ 缺少 POSTGRES_URL 环境变量");
    process.exit(1);
  }

  // 初始化 RAG 系统
  const rag = new BlogRAG(GEMINI_API_KEY, GROQ_API_KEY);

  // 检查命令行参数
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // 单次查询模式
    const question = args.join(" ");
    console.log(`\n❓ 问题：${question}`);
    
    const result = await rag.query(question);
    
    console.log("\n" + "=".repeat(60));
    console.log("✨ 回答：");
    console.log(result.answer);
    console.log("=".repeat(60));
    
    console.log("\n📖 参考来源：");
    result.sources.forEach((source, idx) => {
      console.log(`  ${idx + 1}. ${source.source} - ${source.title}`);
      console.log(`     相似度: ${(source.similarity * 100).toFixed(1)}%`);
    });
  } else {
    // 交互式模式
    await interactiveMode(rag);
  }
}

main().catch((err) => {
  console.error("❌ 运行出错：", err);
  process.exit(1);
});
