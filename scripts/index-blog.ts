// scripts/index-blog.ts

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "@vercel/postgres";
import { GoogleGenerativeAI } from "@google/generative-ai";
import matter from "gray-matter";

// 🎉 完全免费方案：Google Gemini Embedding + Neon PostgreSQL
// 1. Google Gemini 提供免费的嵌入模型 API（每分钟 1500 次请求）
// 2. Neon 提供免费的 PostgreSQL + pgvector
// 3. Groq 可用于后续的 AI 对话（超快且免费额度大）

interface Document {
  id: string;
  text: string;
  title: string;
  description: string;
  source: string;
}

// 使用 Google Gemini Embedding API（完全免费，质量高）
class GeminiEmbedding {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model = "text-embedding-004") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async getEmbeddings(texts: string[], skipIndices: Set<number> = new Set()): Promise<number[][]> {
    console.log(`  使用 Gemini ${this.model} 模型（768 维向量）`);
    
    const embeddings: number[][] = [];
    let processedCount = 0;
    const totalToProcess = texts.length - skipIndices.size;
    
    // Gemini 批量处理能力强，但为了稳定性还是逐个处理
    for (let i = 0; i < texts.length; i++) {
      // 跳过未修改的文档
      if (skipIndices.has(i)) {
        embeddings.push([]); // 占位，稍后会被替换
        continue;
      }
      
      processedCount++;
      console.log(`  处理嵌入 ${processedCount}/${totalToProcess}...`);
      
      try {
        const embedding = await this.getEmbedding(texts[i]);
        embeddings.push(embedding);
        
        // Gemini 免费版速率限制：1500 请求/分钟，很宽松
        // 为保险起见，添加小延迟
        if (processedCount < totalToProcess && processedCount % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`  ❌ 处理第 ${i + 1} 个文档时出错:`, error);
        throw error;
      }
    }
    
    return embeddings;
  }
}

// 使用 import.meta.dir 获取当前脚本所在目录，然后向上找到项目根
const projectRoot = import.meta.dir.replace(/[\/\\]scripts$/, ""); // 兼容 Windows 和 Unix 路径

// 加载网站配置信息作为可搜索的文档
async function loadSiteConfigDocuments(): Promise<Document[]> {
  console.log("⚙️  加载网站配置信息...");
  const documents: Document[] = [];

  try {
    // 动态导入配置文件
    const configModule = await import(join(projectRoot, "src", "config.ts"));
    const constantsModule = await import(join(projectRoot, "src", "constants.ts"));
    
    const SITE = configModule.SITE;
    const PROFILE = constantsModule.PROFILE;
    const SOCIALS = constantsModule.SOCIALS;
    const SKILLS = constantsModule.SKILLS;
    const EDUCATION = constantsModule.EDUCATION;
    const PROJECTS = constantsModule.PROJECTS;

    // 1. 网站基本信息文档
    const siteInfoDoc: Document = {
      id: "site-config",
      title: "网站基本信息",
      description: `关于 ${SITE.title} 博客网站的基本配置和信息`,
      text: `
网站名称：${SITE.title}
作者：${SITE.author}
网站地址：${SITE.website}
个人主页：${SITE.profile}
网站描述：${SITE.desc}
语言：${SITE.lang}
时区：${SITE.timezone}
方向：${SITE.dir}

网站功能：
- ${SITE.lightAndDarkMode ? '支持' : '不支持'}亮色/暗色主题切换
- 每页显示 ${SITE.postPerPage} 篇文章
- 首页显示 ${SITE.postPerIndex} 篇文章
- ${SITE.showArchives ? '支持' : '不支持'}文章归档
- ${SITE.showBackButton ? '显示' : '不显示'}返回按钮
- ${SITE.editPost.enabled ? `支持编辑页面功能（${SITE.editPost.text}）` : '不支持编辑页面'}
- ${SITE.dynamicOgImage ? '支持' : '不支持'}动态 OG 图片生成
      `.trim(),
      source: "config.ts",
    };

    // 2. 作者信息文档
    const socialLinks = SOCIALS.map((s: typeof SOCIALS[0]) => `- ${s.name}: ${s.href}`).join('\n');
    const educationInfo = EDUCATION.map((edu: typeof EDUCATION[0]) => 
      `学校：${edu.school}\n时间：${edu.start} - ${edu.end}\n描述：${edu.description}`
    ).join('\n\n');
    
    const authorDoc: Document = {
      id: "author-profile",
      title: "关于作者 / 笔者信息",
      description: `${SITE.author} 的个人简介和联系方式`,
      text: `
关于我：
${PROFILE.aboutMe.replace(/<\/?mark>/g, '')}

职位：${PROFILE.synopsis}
简历：${PROFILE.resume}
头像：${PROFILE.avatar}
简历文件名：${PROFILE.resumeName}

联系方式：
${socialLinks}

教育背景：
${educationInfo}
      `.trim(),
      source: "constants.ts (PROFILE, SOCIALS, EDUCATION)",
    };

    // 3. 技能栈文档
    const skillsList = SKILLS.map((s: typeof SKILLS[0]) => s.name);
    const skillsText = SKILLS.map((s: typeof SKILLS[0]) => `- ${s.name} (logo: ${s.logo})`).join('\n');
    
    const skillsDoc: Document = {
      id: "skills-stack",
      title: "技能栈 / 技术栈",
      description: "作者掌握的编程语言、框架和工具",
      text: `
技能栈列表：

${skillsText}

完整技能列表：${skillsList.join("、")}

总共掌握 ${SKILLS.length} 项技能。
      `.trim(),
      source: "constants.ts (SKILLS)",
    };

    // 4. 项目文档
    const projectsText = PROJECTS.map((proj: typeof PROJECTS[0], index: number) => `
${index + 1}. ${proj.title}
   - 地址: ${proj.href}
   - 技术: ${proj.tags}
   - 描述: ${proj.desc}
   - GitHub: ${proj.github}
   - 状态: ${proj.wip ? '进行中 (WIP)' : '已完成'}
    `.trim()).join('\n\n');
    
    const projectsDoc: Document = {
      id: "projects-list",
      title: "项目列表 / 作品集",
      description: "作者的个人项目和开源作品",
      text: `
个人项目：

${projectsText}

总共 ${PROJECTS.length} 个项目，其中 ${PROJECTS.filter((p: typeof PROJECTS[0]) => p.wip).length} 个正在进行中。
      `.trim(),
      source: "constants.ts (PROJECTS)",
    };

    documents.push(siteInfoDoc, authorDoc, skillsDoc, projectsDoc);
    console.log(`✅ 共加载 ${documents.length} 个网站配置文档`);
    
    for (const doc of documents) {
      console.log(`📄 加载: ${doc.id} - ${doc.title}`);
    }

    return documents;
  } catch (error) {
    console.error("❌ 无法读取配置文件：", error);
    return []; // 即使失败也继续，只是没有配置信息
  }
}

async function loadDocuments(): Promise<Document[]> {
  console.log("📚 使用 gray-matter 加载博客文章（与 Astro schema 保持一致）...");
  
  const postsDir = join(projectRoot, "src", "data", "blog");

  try {
    const files = await readdir(postsDir);
    const documents: Document[] = [];

    for (const file of files) {
      if (file.endsWith(".md") || file.endsWith(".mdx")) {
        const filePath = join(postsDir, file);
        const fileContent = await readFile(filePath, "utf-8");

        // 使用 gray-matter 可靠地解析 frontmatter
        const { data: frontmatter, content } = matter(fileContent);

        // 跳过草稿文章
        if (frontmatter.draft === true) {
          console.log(`⏭️  跳过草稿: ${frontmatter.title || file}`);
          continue;
        }

        // 验证必需字段（与 Astro schema 保持一致）
        if (!frontmatter.title || !frontmatter.description) {
          console.warn(`⚠️  跳过（缺少必需字段）: ${file}`);
          continue;
        }

        const document: Document = {
          id: file,
          title: frontmatter.title,
          description: frontmatter.description || "", // 确保不会是 undefined
          text: content, // gray-matter 自动去除了 frontmatter
          source: file,
        };

        documents.push(document);
        console.log(`📄 加载: ${file}`);
        console.log(`   标题: ${frontmatter.title}`);
        console.log(`   描述: ${frontmatter.description?.substring(0, 50)}...`);
      }
    }

    console.log(`✅ 共加载 ${documents.length} 篇博客文章（已过滤草稿）`);
    return documents;
  } catch (error) {
    console.error("❌ 无法读取文章目录，请检查路径是否正确：", postsDir);
    console.error(error);
    process.exit(1);
  }
}

async function initDatabase() {
  console.log("📦 初始化数据库表...");

  // 创建 pgvector 扩展
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // 创建文档表（768 维度是 Gemini text-embedding-004 模型的输出维度）
  await sql`
    CREATE TABLE IF NOT EXISTS blog_embeddings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      source TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding vector(768) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 如果表已存在但没有 description 字段，添加它
  try {
    await sql`
      ALTER TABLE blog_embeddings 
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
    `;
  } catch {
    // 忽略错误（列可能已存在）
  }

  // 创建向量索引以加速搜索
  await sql`
    CREATE INDEX IF NOT EXISTS blog_embeddings_vector_idx 
    ON blog_embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  console.log("✅ 数据库表已就绪（768 维向量）");
}

async function storeEmbeddings(
  documents: Document[],
  embeddings: number[][],
  skipIndices: Set<number>
) {
  console.log("\n💾 保存到 Neon 数据库...");

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const embedding = embeddings[i];

    // 跳过未修改的文档（不需要更新数据库）
    if (skipIndices.has(i)) {
      skippedCount++;
      console.log(`  ⏭️  跳过（未修改）: ${doc.title}`);
      continue;
    }

    // 检查是新增还是更新（用于统计）
    const existing = await sql`
      SELECT id FROM blog_embeddings WHERE id = ${doc.id}
    `;
    const isNew = !existing.rowCount || existing.rowCount === 0;

    // Upsert 文档（如果存在则更新）
    await sql`
      INSERT INTO blog_embeddings (id, title, description, source, text, embedding)
      VALUES (
        ${doc.id},
        ${doc.title},
        ${doc.description},
        ${doc.source},
        ${doc.text},
        ${JSON.stringify(embedding)}::vector
      )
      ON CONFLICT (id) 
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        created_at = CURRENT_TIMESTAMP
    `;

    if (isNew) {
      newCount++;
      console.log(`  ✅ 新增: ${doc.title}`);
    } else {
      updatedCount++;
      console.log(`  🔄 更新: ${doc.title}`);
    }
  }

  console.log(`\n📊 处理统计：新增 ${newCount} 篇，更新 ${updatedCount} 篇，跳过 ${skippedCount} 篇`);
}

async function cleanupDeletedDocuments(currentDocIds: string[]) {
  console.log("\n🧹 清理已删除的文章...");

  if (currentDocIds.length === 0) {
    console.log("  ⚠️  当前没有文档，跳过清理");
    return;
  }

  // 获取所有数据库中的文档
  const allDocs = await sql`SELECT id, title FROM blog_embeddings`;
  
  // 找出需要删除的文档
  const toDelete = allDocs.rows.filter((row) => !currentDocIds.includes(row.id as string));

  if (toDelete.length === 0) {
    console.log("  ✓ 没有需要清理的文档");
    return;
  }

  console.log(`  发现 ${toDelete.length} 篇已删除的文章：`);
  for (const doc of toDelete) {
    console.log(`    - ${doc.title}`);
    // 逐个删除
    await sql`DELETE FROM blog_embeddings WHERE id = ${doc.id}`;
  }

  console.log(`  ✅ 已清理 ${toDelete.length} 篇已删除的文章`);
}

async function main() {
  console.log("🚀 开始为你的 Astro 博客构建 AI 知识库（完全免费方案）...");

  // 检查命令行参数
  const args = process.argv.slice(2);
  const forceReindex = args.includes("--force") || args.includes("-f");
  
  if (forceReindex) {
    console.log("⚠️  强制重新索引模式：将重新生成所有文档的向量");
  }

  // 检查环境变量
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? Bun.env.GEMINI_API_KEY;
  const POSTGRES_URL = process.env.POSTGRES_URL ?? Bun.env.POSTGRES_URL;

  if (!GEMINI_API_KEY) {
    console.error("❌ 缺少 GEMINI_API_KEY 环境变量");
    console.error("💡 获取免费 API Key：https://aistudio.google.com/app/apikey");
    console.error("💡 然后在 .env.local 添加：GEMINI_API_KEY=你的密钥");
    process.exit(1);
  }

  if (!POSTGRES_URL) {
    console.error("❌ 缺少 POSTGRES_URL 环境变量");
    console.error("💡 从 Neon 控制台复制连接字符串");
    console.error("💡 然后在 .env.local 添加：POSTGRES_URL=你的连接字符串");
    process.exit(1);
  }

  // 初始化数据库
  await initDatabase();

  // 加载博客文章
  const blogDocuments = await loadDocuments();
  
  // 加载网站配置信息
  const configDocuments = await loadSiteConfigDocuments();
  
  // 合并所有文档
  const documents = [...blogDocuments, ...configDocuments];
  console.log(`\n📦 总计 ${documents.length} 个文档（${blogDocuments.length} 篇文章 + ${configDocuments.length} 个配置）`);

  if (documents.length === 0) {
    console.warn("⚠️  没有找到任何 .md/.mdx 文件，请检查目录路径。");
    return;
  }

  // 检查哪些文档需要更新（增量更新优化）
  const skipIndices = new Set<number>();
  const existingEmbeddings: Map<number, number[]> = new Map();

  if (!forceReindex) {
    console.log("\n🔍 检查需要更新的文档...");
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const existing = await sql`
        SELECT title, description, text, embedding FROM blog_embeddings WHERE id = ${doc.id}
      `;

      // 检查标题、描述和正文是否都未修改
      if (existing.rowCount && existing.rowCount > 0 && 
          existing.rows[0].text === doc.text && 
          existing.rows[0].title === doc.title &&
          existing.rows[0].description === doc.description) {
        // 文档未修改，跳过嵌入生成
        skipIndices.add(i);
        existingEmbeddings.set(i, JSON.parse(existing.rows[0].embedding));
      }
    }
  } else {
    console.log("\n⚡ 跳过增量检查，将重新生成所有向量...");
  }

  console.log(`  需要处理：${documents.length - skipIndices.size}/${documents.length} 篇文章`);
  if (skipIndices.size > 0) {
    console.log(`  跳过未修改：${skipIndices.size} 篇`);
  }

  // 使用 Google Gemini 免费嵌入模型
  console.log("\n✨ 使用 Google Gemini 嵌入模型（质量高，速度快）...");
  const embedder = new GeminiEmbedding(GEMINI_API_KEY);

  console.log("🔄 正在生成向量嵌入（完全免费，仅处理新的/修改的文档）...");
  // 将标题、描述和正文组合在一起，提高搜索准确度
  const texts = documents.map((doc) => {
    const parts = [doc.title];
    if (doc.description) {
      parts.push(doc.description);
    }
    parts.push(doc.text);
    return parts.join("\n\n");
  });
  const embeddings = await embedder.getEmbeddings(texts, skipIndices);

  // 用已存在的嵌入填充跳过的文档
  for (const [index, embedding] of existingEmbeddings) {
    embeddings[index] = embedding;
  }

  // 保存到 Neon 数据库
  await storeEmbeddings(documents, embeddings, skipIndices);

  // 清理已删除的文档
  const currentDocIds = documents.map((doc) => doc.id);
  await cleanupDeletedDocuments(currentDocIds);

  console.log("\n🎉 成功！你的博客内容已全部转化为 AI 可搜索的知识库！");
  console.log("📊 统计信息：");
  console.log(`  - 文档数量: ${documents.length}`);
  console.log(`  - 向量维度: ${embeddings[0]?.length || 0} (Gemini text-embedding-004)`);
  console.log(`  - 存储位置: Neon PostgreSQL`);
  console.log("\n💡 提示：");
  console.log("  - 后续可以使用 Gemini/Groq 做 AI 对话");
  console.log("  - Gemini 免费额度：每分钟 1500 次嵌入请求");
  console.log("  - 增量更新：bun run index-blog");
  console.log("  - 强制重建：bun run index-blog --force");
}

main().catch((err) => {
  console.error("❌ 构建过程出错：", err);
  process.exit(1);
});