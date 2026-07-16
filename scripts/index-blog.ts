// scripts/index-blog.ts

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, sql, type VercelClientBase } from "@vercel/postgres";
import { GoogleGenAI } from "@google/genai";
import matter from "gray-matter";
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  embedDocument,
} from "../src/lib/gemini-embedding";

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
  private genAI: GoogleGenAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async getEmbedding(text: string, title?: string): Promise<number[]> {
    return embedDocument(this.genAI, text, title);
  }

  async getEmbeddings(
    texts: string[],
    titles: string[],
    skipIndices: Set<number> = new Set()
  ): Promise<number[][]> {
    console.log(`  使用 Gemini ${EMBEDDING_MODEL} 模型（768 维向量）`);

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
        const embedding = await this.getEmbedding(texts[i], titles[i]);
        embeddings.push(embedding);

        // Gemini 免费版速率限制：1500 请求/分钟，很宽松
        // 为保险起见，添加小延迟
        if (processedCount < totalToProcess && processedCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
    const constantsModule = await import(
      join(projectRoot, "src", "constants.ts")
    );

    const SITE = configModule.SITE;
    const PROFILE = constantsModule.PROFILE;
    const SOCIALS = constantsModule.SOCIALS;
    const SKILLS = constantsModule.SKILLS;
    const EDUCATION = constantsModule.EDUCATION;
    const PROJECTS = constantsModule.PROJECTS;

    // 1. 网站基本信息文档（优化：增加问答形式和关键词）
    const siteInfoDoc: Document = {
      id: "site-config",
      title: "网站基本信息和配置",
      description: `${SITE.title} 博客网站的基本配置、网站功能、主题设置、显示选项等信息`,
      text: `
# 网站基本信息

## 关于这个博客网站
这是 ${SITE.author} 的个人博客网站。

网站名称：${SITE.title}
网站作者：${SITE.author}
网站地址：${SITE.website}
个人主页链接：${SITE.profile}
网站介绍：${SITE.desc}
网站语言：${SITE.lang}
时区设置：${SITE.timezone}
阅读方向：${SITE.dir}

## 网站功能特性
- 主题模式：${SITE.lightAndDarkMode ? "支持亮色/暗色主题切换，可以在明暗模式间自由切换" : "不支持主题切换"}
- 分页设置：每页显示 ${SITE.postPerPage} 篇文章
- 首页文章：首页展示 ${SITE.postPerIndex} 篇文章
- 文章归档：${SITE.showArchives ? "提供文章归档页面，可以按时间查看所有文章" : "不提供文章归档"}
- 导航按钮：${SITE.showBackButton ? "显示返回按钮，方便导航" : "不显示返回按钮"}
- 编辑功能：${SITE.editPost.enabled ? `支持在线编辑页面（编辑按钮文本：${SITE.editPost.text}）` : "不支持在线编辑"}
- OG 图片：${SITE.dynamicOgImage ? "支持动态生成 Open Graph 社交媒体预览图片" : "不支持动态 OG 图片"}

## 常见问题
Q: 这个网站是谁的博客？
A: 这是 ${SITE.author} 的个人博客网站。

Q: 网站地址是什么？
A: ${SITE.website}

Q: 网站支持哪些功能？
A: 支持文章发布、${SITE.lightAndDarkMode ? "主题切换、" : ""}${SITE.showArchives ? "文章归档、" : ""}分页浏览等功能。
      `.trim(),
      source: "config.ts",
    };

    // 2. 作者信息文档（优化：强化"关于作者"关键词）
    const socialLinks = SOCIALS.map(
      (s: (typeof SOCIALS)[0]) => `- ${s.name}: ${s.href}`
    ).join("\n");
    const educationInfo = EDUCATION.map(
      (edu: (typeof EDUCATION)[0]) =>
        `- ${edu.school}（${edu.start} - ${edu.end}）\n  ${edu.description}`
    ).join("\n");

    const authorDoc: Document = {
      id: "author-profile",
      title: "关于作者的信息和个人简介",
      description: `关于作者 ${SITE.author} 的详细信息：个人介绍、职业背景、教育经历、联系方式、社交媒体账号`,
      text: `
# 关于作者的信息
# 关于 ${SITE.author} 的个人简介

## 个人简介
${PROFILE.aboutMe.replace(/<\/?mark>/g, "")}

## 职业信息
当前职位：${PROFILE.synopsis}
在线简历地址：${PROFILE.resume}
简历文件：${PROFILE.resumeName}
个人头像：${PROFILE.avatar}

## 联系方式和社交媒体
如何联系 ${SITE.author}？可以通过以下方式：
${socialLinks}

## 教育背景
${SITE.author} 的教育经历：
${educationInfo}

## 常见问题

Q: 关于作者的信息有哪些？
A: 关于作者 ${SITE.author} 的信息包括：职业是 ${PROFILE.synopsis}，教育背景是 ${EDUCATION.map((edu: (typeof EDUCATION)[0]) => edu.school).join("、")}，可以通过 ${SOCIALS.map((s: (typeof SOCIALS)[0]) => s.name).join("、")} 联系。

Q: 作者是谁？
A: 作者是 ${SITE.author}，职业：${PROFILE.synopsis}

Q: 如何联系作者？
A: 可以通过 ${SOCIALS.map((s: (typeof SOCIALS)[0]) => s.name).join("、")} 等方式联系作者。

Q: 作者的教育背景如何？
A: 作者毕业于 ${EDUCATION.map((edu: (typeof EDUCATION)[0]) => edu.school).join("、")}。

Q: 在哪里可以看到作者的简历？
A: 作者的在线简历：${PROFILE.resume}

Q: 告诉我关于作者的详细信息？
A: 关于作者的详细信息：${SITE.author} 是一位 ${PROFILE.synopsis}，毕业于 ${EDUCATION.map((edu: (typeof EDUCATION)[0]) => edu.school).join("、")}，联系方式包括 ${SOCIALS.slice(
        0,
        2
      )
        .map((s: (typeof SOCIALS)[0]) => s.name)
        .join("和")}。

关键词：关于作者、作者信息、作者简介、个人资料、联系作者、author profile、about me
      `.trim(),
      source: "constants.ts (PROFILE, SOCIALS, EDUCATION)",
    };

    // 3. 技能栈文档（优化：大幅增加关键词和问答）
    const skillsList = SKILLS.map((s: (typeof SKILLS)[0]) => s.name);
    const skillsText = SKILLS.map(
      (s: (typeof SKILLS)[0]) => `- ${s.name}`
    ).join("\n");

    const skillsDoc: Document = {
      id: "skills-stack",
      title: "技能栈技术栈编程技能",
      description: `${SITE.author} 掌握的技能栈、技术栈、编程语言、开发框架、工具链、技术能力清单`,
      text: `
# 技能栈 | 技术栈 | 编程技能

## ${SITE.author} 掌握的技能和技术

### 完整技能列表
${skillsText}

### 技能统计
- 总计掌握 ${SKILLS.length} 项技术技能
- 技能类型包括：编程语言、开发框架、工具链、数据库等
- 完整技能：${skillsList.join("、")}

### 技术栈详情
${SKILLS.map((s: (typeof SKILLS)[0], idx: number) => `${idx + 1}. ${s.name}`).join("\n")}

## 常见问题

Q: ${SITE.author} 会哪些编程语言？
A: ${SITE.author} 掌握的编程语言和技术包括：${skillsList.join("、")}等 ${SKILLS.length} 项技能。

Q: 技能栈有哪些？
A: 完整技能栈列表：${skillsList.join("、")}。

Q: 掌握什么技术？
A: 掌握的技术栈包括：${skillsList.join("、")}。

Q: 会使用哪些框架和工具？
A: 技术栈涵盖了编程语言、框架和工具，包括 ${skillsList.slice(0, Math.min(5, skillsList.length)).join("、")}${skillsList.length > 5 ? "等" : ""}。

Q: 技术能力如何？
A: ${SITE.author} 掌握 ${SKILLS.length} 项技术技能，包括${skillsList.slice(0, 3).join("、")}等多种编程语言和框架。

关键词：技能栈、技术栈、编程语言、开发框架、技术能力、programming skills、tech stack、技术清单
      `.trim(),
      source: "constants.ts (SKILLS)",
    };

    // 4. 项目文档（强化优化：明确区分项目和博客）
    const projectsText = PROJECTS.map(
      (proj: (typeof PROJECTS)[0], index: number) =>
        `
### 项目 ${index + 1}：${proj.title}
- 项目名称：${proj.title}
- 项目链接：${proj.href}
- 技术栈：${proj.tags}
- 项目简介：${proj.desc}
- GitHub 地址：${proj.github}
- 开发状态：${proj.wip ? "正在开发中 (Work In Progress)" : "已完成上线"}
    `.trim()
    ).join("\n\n");

    const completedProjects = PROJECTS.filter(
      (p: (typeof PROJECTS)[0]) => !p.wip
    );
    const wipProjects = PROJECTS.filter((p: (typeof PROJECTS)[0]) => p.wip);
    const projectNames = PROJECTS.map((p: (typeof PROJECTS)[0]) => p.title);

    const projectsDoc: Document = {
      id: "projects-list",
      title: "开发项目列表和作品集",
      description: `${SITE.author} 的开发项目、实际项目、作品集、个人作品、开源项目、项目经验（不是博客文章）`,
      text: `
# 开发项目列表和作品集
# ${SITE.author} 的实际开发项目和个人作品
## 注意：这里是开发项目，不是博客文章

${projectsText}

## 开发项目统计数据
- 开发项目总数：${PROJECTS.length} 个实际项目
- 已完成的项目：${completedProjects.length} 个
- 正在开发的项目：${wipProjects.length} 个
- 完整项目列表：${projectNames.join("、")}
- 重要提示：这些是实际的开发项目和作品，不是博客文章

## 已完成并上线的项目
${completedProjects.length > 0 ? completedProjects.map((p: (typeof PROJECTS)[0]) => `- 项目《${p.title}》：${p.desc} (${p.href})`).join("\n") : "暂无"}

## 正在开发中的项目
${wipProjects.length > 0 ? wipProjects.map((p: (typeof PROJECTS)[0]) => `- 项目《${p.title}》：${p.desc} (开发中)`).join("\n") : "暂无"}

## 常见问题（关于开发项目）

Q: 有哪些项目？
A: ${SITE.author} 开发了 ${PROJECTS.length} 个实际项目，分别是：${projectNames.join("、")}。这些是实际的开发项目作品，不是博客文章。

Q: 开发过哪些项目？
A: 开发的项目包括：${projectNames.join("、")}，共 ${PROJECTS.length} 个实际开发项目。

Q: 作品集有哪些项目？
A: 作品集中的开发项目有：${projectNames.join("、")}，总共 ${PROJECTS.length} 个项目作品。

Q: 做过什么实际项目？
A: 实际开发的项目作品有：${projectNames.join("、")}。

Q: 项目作品有哪些？
A: 项目作品包括 ${PROJECTS.length} 个：${projectNames.join("、")}。

Q: 有哪些开源项目作品？
A: GitHub 上的开源项目作品包括：${PROJECTS.filter(
        (p: (typeof PROJECTS)[0]) => p.github
      )
        .map((p: (typeof PROJECTS)[0]) => p.title)
        .join("、")}。

Q: 这些项目使用了什么技术？
A: 项目开发使用的技术栈包括：${[...new Set(PROJECTS.flatMap((p: (typeof PROJECTS)[0]) => p.tags.split(/[,，、]/).map((t: string) => t.trim())))].join("、")}等技术。

Q: 项目列表是什么？
A: 项目列表共有 ${PROJECTS.length} 个开发项目：${projectNames.join("、")}。

重要说明：
- 这是实际的开发项目列表，不是博客文章
- 每个项目都有对应的项目地址和 GitHub 仓库
- 项目作品展示了实际的开发能力和技术栈

关键词：开发项目、实际项目、项目列表、作品集、个人作品、开源项目、项目经验、项目作品、portfolio、projects、实战项目、上线项目
      `.trim(),
      source: "constants.ts (PROJECTS)",
    };

    documents.push(siteInfoDoc, authorDoc, skillsDoc, projectsDoc);
    console.log(`✅ 共加载 ${documents.length} 个网站配置文档`);

    for (const doc of documents) {
      console.log(`📄 加载配置: ${doc.id} - ${doc.title}`);
      console.log(`   描述: ${doc.description.substring(0, 60)}...`);
      console.log(`   文本长度: ${doc.text.length} 字符`);
    }

    return documents;
  } catch (error) {
    console.error("❌ 无法读取配置文件：", error);
    return []; // 即使失败也继续，只是没有配置信息
  }
}

async function loadDocuments(): Promise<Document[]> {
  console.log(
    "📚 使用 gray-matter 加载博客文章（与 Astro schema 保持一致）..."
  );

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

        // 在标题和描述中明确标注这是博客文章，帮助区分项目
        const document: Document = {
          id: file.replace(/\.mdx?$/, ""),
          title: `博客文章：${frontmatter.title}`,
          description: `这是一篇博客文章（不是项目）：${frontmatter.description || ""}`,
          text: `这是一篇博客文章的内容：\n\n${content}`, // 明确标注是博客文章
          source: file,
        };

        documents.push(document);
        console.log(`📄 加载博客: ${file}`);
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

  // 保持 768 维，兼容现有 pgvector 列定义
  await sql`
    CREATE TABLE IF NOT EXISTS blog_embeddings_v2 (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      source TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding vector(768) NOT NULL,
      embedding_model TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 如果表已存在但没有 description 字段，添加它
  try {
    await sql`
      ALTER TABLE blog_embeddings_v2
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
    `;
  } catch {
    // 忽略错误（列可能已存在）
  }

  await sql`
    ALTER TABLE blog_embeddings_v2
    ADD COLUMN IF NOT EXISTS embedding_model TEXT
  `;

  // 当前语料规模很小，精确余弦扫描比 IVFFlat 更可靠。
  await sql`DROP INDEX IF EXISTS blog_embeddings_v2_vector_idx`;

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

  const client = createClient();
  await client.connect();

  try {
    await client.sql`BEGIN`;

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
      const existing = await client.sql`
        SELECT id FROM blog_embeddings_v2 WHERE id = ${doc.id}
      `;
      const isNew = !existing.rowCount || existing.rowCount === 0;

    // Upsert 文档（如果存在则更新）
      await client.sql`
        INSERT INTO blog_embeddings_v2 (id, title, description, source, text, embedding, embedding_model)
        VALUES (
          ${doc.id},
          ${doc.title},
          ${doc.description},
          ${doc.source},
          ${doc.text},
          ${JSON.stringify(embedding)}::vector,
          ${EMBEDDING_VERSION}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          text = EXCLUDED.text,
          embedding = EXCLUDED.embedding,
          embedding_model = EXCLUDED.embedding_model,
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

    await cleanupDeletedDocuments(
      documents.map(doc => doc.id),
      client
    );
    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    await client.end();
  }

  console.log(
    `\n📊 处理统计：新增 ${newCount} 篇，更新 ${updatedCount} 篇，跳过 ${skippedCount} 篇`
  );
}

async function cleanupDeletedDocuments(
  currentDocIds: string[],
  client: VercelClientBase
) {
  console.log("\n🧹 清理已删除的文章...");

  if (currentDocIds.length === 0) {
    console.log("  ⚠️  当前没有文档，跳过清理");
    return;
  }

  // 获取所有数据库中的文档
  const allDocs = await client.sql`SELECT id, title FROM blog_embeddings_v2`;

  // 找出需要删除的文档
  const toDelete = allDocs.rows.filter(
    row => !currentDocIds.includes(row.id as string)
  );

  if (toDelete.length === 0) {
    console.log("  ✓ 没有需要清理的文档");
    return;
  }

  console.log(`  发现 ${toDelete.length} 篇已删除的文章：`);
  for (const doc of toDelete) {
    console.log(`    - ${doc.title}`);
    // 逐个删除
    await client.sql`DELETE FROM blog_embeddings_v2 WHERE id = ${doc.id}`;
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
    console.error(
      "💡 获取免费 API Key：https://aistudio.google.com/app/apikey"
    );
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
  console.log(
    `\n📦 总计 ${documents.length} 个文档（${blogDocuments.length} 篇文章 + ${configDocuments.length} 个配置）`
  );

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
        SELECT title, description, text, embedding, embedding_model FROM blog_embeddings_v2 WHERE id = ${doc.id}
      `;

      // 检查标题、描述和正文是否都未修改
      if (
        existing.rowCount &&
        existing.rowCount > 0 &&
        existing.rows[0].text === doc.text &&
        existing.rows[0].title === doc.title &&
        existing.rows[0].description === doc.description &&
        existing.rows[0].embedding_model === EMBEDDING_VERSION
      ) {
        // 文档未修改，跳过嵌入生成
        skipIndices.add(i);
        existingEmbeddings.set(i, JSON.parse(existing.rows[0].embedding));
      }
    }
  } else {
    console.log("\n⚡ 跳过增量检查，将重新生成所有向量...");
  }

  console.log(
    `  需要处理：${documents.length - skipIndices.size}/${documents.length} 篇文章`
  );
  if (skipIndices.size > 0) {
    console.log(`  跳过未修改：${skipIndices.size} 篇`);
  }

  // 使用 Google Gemini 免费嵌入模型
  console.log("\n✨ 使用 Google Gemini 嵌入模型（质量高，速度快）...");
  const embedder = new GeminiEmbedding(GEMINI_API_KEY);

  console.log("🔄 正在生成向量嵌入（完全免费，仅处理新的/修改的文档）...");
  // 将标题、描述和正文组合在一起，提高搜索准确度
  const texts = documents.map(doc => {
    const parts: string[] = [];
    if (doc.description) {
      parts.push(doc.description);
    }
    parts.push(doc.text);
    return parts.join("\n\n");
  });
  const embeddings = await embedder.getEmbeddings(
    texts,
    documents.map(doc => doc.title),
    skipIndices
  );

  // 用已存在的嵌入填充跳过的文档
  for (const [index, embedding] of existingEmbeddings) {
    embeddings[index] = embedding;
  }

  // 保存到 Neon 数据库
  await storeEmbeddings(documents, embeddings, skipIndices);

  console.log("\n🎉 成功！你的博客内容已全部转化为 AI 可搜索的知识库！");
  console.log("📊 统计信息：");
  console.log(`  - 文档数量: ${documents.length}`);
  console.log(
    `  - 向量维度: ${embeddings[0]?.length || 0} (Gemini ${EMBEDDING_MODEL})`
  );
  console.log(`  - 存储位置: Neon PostgreSQL`);
  console.log("\n💡 提示：");
  console.log("  - 后续可以使用 Gemini/Groq 做 AI 对话");
  console.log("  - Gemini 免费额度：每分钟 1500 次嵌入请求");
  console.log("  - 增量更新：bun run index-blog");
  console.log("  - 强制重建：bun run index-blog --force");
}

main().catch(err => {
  console.error("❌ 构建过程出错：", err);
  process.exit(1);
});
