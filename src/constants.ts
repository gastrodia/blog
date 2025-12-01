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
      Hi, I'm <mark>Jia Jiwei</mark>, born in 1997. Currently working in
      Shenzhen, Guangdong. As a Web Developer, This space documents my
      professional expertise and career journey.
`,
  synopsis: "Full Stack Web Developer",
  resumeName: `前端开发工程师_贾继伟`,
  avatar: "/assets/images/about/self.jpg",
  resume: `/resume.pdf`
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
    name: "Javascript",
    logo: `Javascript`,
  },
  {
    name: "Typescript",
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
    name: "ThreeJs",
    logo: `ThreeJs`,
  },
  {
    name: "NodeJs",
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
    name: "Tailwindcss",
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
    title: "Blog",
    href: "/posts",
    tags: "Astro",
    desc: "This website",
    github: "https://github.com/gastrodia/blog",
    wip: true,
  },
  {
    title: "Rust Note",
    href: "https://rs.jiajiwei.top",
    tags: "Rust",
    desc: "Notes on learning the rust language",
    github: "https://github.com/gastrodia/note-rust",
    wip: true,
  },
  {
    title: "Three.js Note",
    href: "https://gastrodia.github.io/learn-three",
    tags: "Three.js",
    desc: "Notes on learning the three.js framework",
    github: "https://github.com/gastrodia/learn-three",
    wip: true,
  },
  {
    title: "Share Vue3.0",
    href: "https://gastrodia.github.io/demo",
    tags: "Vue",
    desc: "Learn about Vue3.0 quickly",
    github: "https://github.com/gastrodia/demo",
    wip: false,
  },
  {
    title: "Deno p2p chat",
    href: "https://deno-p2p-chat.deno.dev/",
    tags: "Deno,DenoKV,Fresh",
    desc: "An instant messaging system based on Deno, Fresh, DenoKV, and daisyui.",
    github: "https://github.com/gastrodia/deno-p2p-chat",
    wip: false,
  },
];
