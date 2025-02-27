import { getCollection } from "astro:content";
import generateOgImage from "@utils/generateOgImage";
import type { APIRoute } from "astro";
import type { InferEntrySchema } from "astro:content";

export const GET: APIRoute<InferEntrySchema<"blog">> = async ({ props }) => {
  const img = await generateOgImage(props);
  return new Response(img);
};

const postImportResult = await getCollection("blog", ({ data }) => !data.draft);
const posts = Object.values(postImportResult);

export function getStaticPaths() {
  return posts
    .filter(({ data }) => !data.ogImage)
    .map(({ data }) => ({
      params: { slug: data.postSlug },
      props: data,
    }));
}
