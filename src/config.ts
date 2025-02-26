import type { Site, SocialObjects } from "./types";
import type { GiscusProps } from "@giscus/react";
import {
  TypescriptLogo,
  PythonLogo,
  ReactLogo,
  LinuxLogo,
  GitLogo,
  JavascriptLogo,
  VueLogo,
  NodeLogo,
  BunLogo,
  RustLogo,
  DenoLogo,
  TailwindLogo,
  ThreeJsLogo,
  AngularLogo,
  AstroLogo,
} from "./components/icons";

export const SITE: Site = {
  website: "https://jiajiwei.top/",
  author: "Code_You",
  desc: "记录与分享我的前端生活。",
  title: "Code_You",
  ogImage: "astropaper-og.jpg",
  postPerPage: 10,
  synopsis: "Full Stack Web Developer",
  aboutMe: `
      Hi, I'm <mark>Jia Jiwei</mark>, born in 1997. Currently working in
      Shenzhen, Guangdong. As a Web Developer, This space documents my
      professional expertise and career journey.
  `,
};

const LANG = "zh-CN";

export const GISCUS: GiscusProps = {
  repo: "gastrodia/blog",
  repoId: "R_kgDOJ1bm_g",
  mapping: "pathname",
  categoryId: "DIC_kwDOJ1bm_s4CnGP_",
  lang: LANG,
};

export const LOCALE = [LANG]; // set to [] to use the environment default

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/gastrodia",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:3025822868@qq.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "Instagram",
    href: "https://photo.jiajiwei.top/",
    linkTitle: `My Photo`,
    active: true,
  },
];

export const SKILLS = [
  {
    name: "Javascript",
    logo: JavascriptLogo,
  },
  {
    name: "Typescript",
    logo: TypescriptLogo,
  },
  {
    name: "Vue",
    logo: VueLogo,
  },
  {
    name: "Angular",
    logo: AngularLogo,
  },
  {
    name: "React",
    logo: ReactLogo,
  },
  {
    name: "Astro",
    logo: AstroLogo,
  },
  {
    name: "ThreeJs",
    logo: ThreeJsLogo,
  },
  {
    name: "NodeJs",
    logo: NodeLogo,
  },
  {
    name: "Bun",
    logo: BunLogo,
  },
  {
    name: "Deno",
    logo: DenoLogo,
  },
  {
    name: "Tailwindcss",
    logo: TailwindLogo,
  },
  {
    name: "Rust",
    logo: RustLogo,
  },
  {
    name: "Python",
    logo: PythonLogo,
  },
  {
    name: "Linux/Bash",
    logo: LinuxLogo,
  },
  {
    name: "Git",
    logo: GitLogo,
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
    href: "https://jiajiwei.top",
    tags: "Astro",
    desc: "This website",
    github: "https://github.com/gastrodia/blog",
    wip: false,
  },
  {
    title: "Rust Note",
    href: "https://rs.jiajiwei.top",
    tags: "Rust",
    desc: "Notes on learning the rust language",
    github: "https://github.com/gastrodia/note-rust",
    wip: false,
  },
  {
    title: "Three.js Note",
    href: "https://gastrodia.github.io/learn-three",
    tags: "Three.js",
    desc: "Notes on learning the three.js framework",
    github: "https://github.com/gastrodia/learn-three",
    wip: false,
  },
  {
    title: "Share Vue3.0",
    href: "https://gastrodia.github.io/demo",
    tags: "Vue",
    desc: "Learn about Vue3.0 quickly",
    github: "https://github.com/gastrodia/demo",
    wip: false,
  },
];
