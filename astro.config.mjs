import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import { SITE } from "./src/config";
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: SITE.website,

  integrations: [
    tailwind({
      config: {
        applyBaseStyles: false,
      },
    }),
    react(),
    sitemap(),
  ],

  markdown: {
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    shikiConfig: {
      themes: { light: "min-light", dark: "nord" },
      wrap: true,
    },
    extendDefaultPlugins: true,
  },

  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },

  scopedStyleStrategy: "where",
  adapter: vercel(),
});