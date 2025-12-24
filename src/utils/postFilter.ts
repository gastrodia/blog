import type { CollectionEntry } from "astro:content";

const postFilter = ({ data }: CollectionEntry<"blog">) => {
  return !data.draft && import.meta.env.DEV;
};

export default postFilter;
