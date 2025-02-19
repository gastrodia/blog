import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://jiajiwei.top/",
  author: "Code_You",
  desc: "记录与分享我的前端生活。",
  title: "Code_You",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerPage: 10,
};

export const LOCALE = ["zh-CN"]; // set to [] to use the environment default

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
];
