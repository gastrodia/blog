import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getPath } from "@/utils/getPath";
import getSortedPosts from "@/utils/getSortedPosts";
import { SITE } from "@/config";

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");
  const sortedPosts = getSortedPosts(posts);

  const content = `# ${SITE.title}

> ${SITE.desc} Built with Astro and deployed on Vercel.

This blog covers web development, JavaScript frameworks, and various technical topics. Articles are written in Chinese with code examples and practical implementations.

## Blog Posts

${sortedPosts
  .map(
    post =>
      `- [${post.data.title}](${getPath(post.id, post.filePath)}): ${post.data.description}`
  )
  .join("\n")}

## Pages

- [Resume](/resume): Professional resume and CV
- [Archives](/archives): Complete archive of all blog posts
- [Tags](/tags): Browse posts by tags and categories
- [Contact](/contact): Contact information and form

## Technical Details

- Built with Astro framework
- Styled with Tailwind CSS
- Deployed on Vercel
- Uses TypeScript
- Includes RSS feed and sitemap`;

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
