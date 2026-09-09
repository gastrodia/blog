import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: string;
}

export const GISCUS = {
  repo: "gastrodia/blog",
  repoId: "R_kgDOJ1bm_g",
  mapping: "pathname",
  categoryId: "DIC_kwDOJ1bm_s4CnGP_",
  lang: SITE.lang,
} as const;

export const PROFILE = {
  aboutMe: `
      <p>I'm Jia Jiwei, also known online as gastrodia. Born in 1997 and
      working in Shenzhen, Guangdong, I started in frontend engineering.
      Today, I build across the full stack with AI as part of my development process.</p>
      <p>My focus has expanded from individual interfaces to complete web products,
      with frontend experience still at the heart of my work. I work mainly with
      TypeScript, Vue, Astro, Node.js, and Deno.</p>
      <p>This blog connects my earlier engineering notes with what comes next:
      building products, working with AI, and documenting the decisions along the way.</p>
`,
  synopsis: "AI Full-Stack Developer",
  resumeName: `前端开发工程师_贾继伟`,
  avatar: "/assets/images/about/self.jpg",
  resume: `/resume.pdf`,
} as const;

export const SOCIALS: Social[] = [
  {
    name: "Github",
    href: "https://github.com/gastrodia",
    linkTitle: ` ${SITE.title} on Github`,
    icon: `GitHub`,
  },
  {
    name: "Mail",
    href: "mailto:me@jiajiwei.top",
    linkTitle: `Send an email to ${SITE.title}`,
    icon: `Mail`,
  },
  {
    name: "Photo",
    href: "https://photo.jiajiwei.top/",
    linkTitle: `My Photo`,
    icon: `Instagram`,
  },
];

export const SHARE_LINKS: Social[] = [
  {
    name: "WhatsApp",
    href: "https://wa.me/?text=",
    linkTitle: `Share this post via WhatsApp`,
    icon: `Whatsapp`,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: `Share this post on Facebook`,
    icon: `Facebook`,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: `BrandX`,
  },
  {
    name: "Telegram",
    href: "https://t.me/share/url?url=",
    linkTitle: `Share this post via Telegram`,
    icon: `Telegram`,
  },
  {
    name: "Pinterest",
    href: "https://pinterest.com/pin/create/button/?url=",
    linkTitle: `Share this post on Pinterest`,
    icon: `Pinterest`,
  },
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: `Share this post via email`,
    icon: `Mail`,
  },
];

export const SKILLS = [
  {
    name: "JavaScript",
    logo: `Javascript`,
  },
  {
    name: "TypeScript",
    logo: `Typescript`,
  },
  {
    name: "Vue",
    logo: `Vue`,
  },
  {
    name: "Angular",
    logo: `Angular`,
  },
  {
    name: "React",
    logo: `React`,
  },
  {
    name: "Astro",
    logo: `Astro`,
  },
  {
    name: "Three.js",
    logo: `ThreeJs`,
  },
  {
    name: "Node.js",
    logo: `NodeJs`,
  },
  {
    name: "Bun",
    logo: `Bun`,
  },
  {
    name: "Deno",
    logo: `Deno`,
  },
  {
    name: "Tailwind CSS",
    logo: `Tailwindcss`,
  },
  {
    name: "Rust",
    logo: `Rust`,
  },
  {
    name: "Python",
    logo: `Python`,
  },
  {
    name: "Linux/Bash",
    logo: `Linux`,
  },
  {
    name: "Git",
    logo: `Git`,
  },
];

export const EDUCATION = [
  {
    school: "Wuhan Vocational College of Software and Engineering",
    start: "2015.09",
    end: "2018.06",
    description:
      "Here, I've learned Photoshop, Axure, HTML, CSS, JavaScript, and more. These have become the foundation of my life, helping me find my direction in life!",
  },
];

export const PROJECTS = [
  {
    title: "Ledger",
    href: "https://ledger.jiajiwei.top/",
    tags: "Next.js, React, TypeScript, PostgreSQL",
    desc: "A personal and family ledger for keeping spending, gifts, and loans in view. It connects member-based reports and repayment tracking with optional AI summaries of recorded finances.",
    github: "https://github.com/gastrodia/ledger",
    wip: false,
  },
  {
    title: "Blog",
    href: "/posts",
    tags: "Astro",
    desc: "A home for my technical writing and project notes. I built the Astro site with searchable posts, a resume viewer, and an AI assistant to help readers explore the content.",
    github: "https://github.com/gastrodia/blog",
    wip: true,
  },
  {
    title: "Deno P2P Chat",
    href: "https://deno-p2p-chat.gastrodia.deno.net/",
    tags: "Deno, Fresh, Deno KV, daisyUI",
    desc: "An instant messaging app for chatting on the web. I bring together a Fresh interface and Deno KV storage to explore full-stack development with Deno.",
    github: "https://github.com/gastrodia/deno-p2p-chat",
    wip: false,
  },
];
