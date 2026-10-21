# 访问统计（Umami Cloud）

## 需要配置的内容

1. 在 <https://cloud.umami.is/signup> 注册，选择免费的 Hobby 方案。
2. 在网站管理中新增网站，名称可填 `Code_You`，域名填写 `jiajiwei.top`（不带协议或路径）。
3. 打开该网站的编辑页，在 **Tracking code** 中复制 `data-website-id` 的值。
4. 在 Vercel 项目 **Settings → Environment Variables** 中新增下表配置，选择 **Production** 环境，然后重新部署。

| 环境变量 | 填写内容 |
| --- | --- |
| `PUBLIC_UMAMI_WEBSITE_ID` | 必填：上一步复制的 Website ID |
| `PUBLIC_UMAMI_SCRIPT_URL` | 可选：默认 `https://cloud.umami.is/script.js`；如果后台代码的 `src` 不同，填写后台给出的地址 |

当前网站已取得的配置如下，已写入本地 `.env`。线上仍需将 Website ID 添加到 Vercel 的 Production 环境，并部署本次代码：

```dotenv
PUBLIC_UMAMI_WEBSITE_ID=444e402c-e360-47ad-90f3-e8744c1d9730
PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
```

这两个值是公开的前端配置，不是 API 密钥。不需要配置 Umami API Key、数据库或 DNS。环境变量在构建时写入页面，修改后必须重新部署。

`.env.example` 只列出了新增的统计配置，不包含网站已有的 AI、数据库、邮件等配置。不要用它覆盖已有 `.env` 或 Vercel 配置。

## 已接入的统计

- 全站页面浏览量与来源、设备等基础信息。页面浏览由 Astro 页面加载事件统一触发，元数据由 Umami 提供。
- `view-resume`：点击查看简历；实际简历页面浏览量看 `/resume`。
- `download-resume`：点击下载简历，不代表下载已经完成。
- `project-preview`：点击项目预览，附带 `project` 名称。
- `project-source`：点击项目源码，附带 `project` 名称。
- `social-click`：点击社交或邮箱链接，附带 `channel` 名称。

自定义事件只发送固定事件名和项目/渠道名称，不读取表单邮箱、留言或 AI 对话内容。页面 URL 保留查询参数以支持 UTM 归因，忽略 hash；不要在 URL 中放置敏感信息。

留言结果页 `/contact/success` 和 `/contact/error` 计入普通页面浏览；成功页可直接访问，因此没有将其伪装成真实发送成功事件。

## 运行边界

- 未配置 Website ID 时不加载统计脚本，不影响构建或页面功能。
- `bun run dev` 不加载统计脚本。
- 仅统计 `src/config.ts` 中 `SITE.website` 的域名（当前为 `jiajiwei.top`）；localhost 和 Vercel 预览域名不会上报。
- 关闭 Umami 自动页面上报，在 `astro:page-load` 统一上报一次，覆盖首次加载、Astro 页面切换及前进/后退；同时使用当前页面 URL、标题和上一页来源，避免 Umami 缓存过期。统计脚本延迟加载时，会补报已准备好的当前页面。
- 点击统计使用独立的事件委托，不阻止默认行为，保留 Astro 页面切换、PDF 下载和新标签打开。

## 上线验收

1. 重新部署后，用无痕窗口打开 <https://jiajiwei.top/>。
2. 在浏览器 Network 中检查统计脚本加载成功，并且 Umami 上报请求（通常为 `https://gateway.umami.is/api/send`，以后台当前代码为准）返回成功。
3. 连续访问首页、文章、简历并前进/后退，在 Umami 查看是否每次导航只新增一条页面浏览，标题是否正确。
4. 点击简历下载、项目链接和邮箱，在 Umami 的 Events 中检查相应事件；下载和跳转应保持正常。
5. 如需检查 UTM，可访问 `https://jiajiwei.top/?utm_source=wechat&utm_medium=social&utm_campaign=profile`。
6. 如果主要读者在国内，补测国内网络及微信内浏览器的脚本加载和上报。

若没有数据，先检查 Website ID、正式域名是否匹配、是否重新部署，以及广告拦截插件或浏览器的排除设置。

## 本地验证记录

2026-10-21 已通过 Astro 类型检查、完整构建、改动文件的 ESLint 和格式检查。Chrome 浏览器验证覆盖首次访问、Astro 页面切换、前进/后退、页面标题、UTM、全部点击事件、原生 PDF 下载、域名过滤、排除本人访问，以及统计脚本延迟加载或被拦截的情况。

浏览器测试使用当日下载的 Umami Cloud 真实脚本及测试 Website ID，上报请求被本地拦截，没有写入真实 Umami 数据。未配置 Website ID 时，全部 70 个生成页面都不含统计脚本。云端收数和国内/微信网络仍需配置并部署后按上述步骤验收。

## 排除自己的访问

在正式网站的浏览器控制台执行，然后刷新：

```js
localStorage.setItem("umami.disabled", "1");
```

此设置只作用于当前浏览器和网站。无痕窗口、其他浏览器或设备需要单独设置。恢复统计：

```js
localStorage.removeItem("umami.disabled");
```

参考：[采集数据](https://docs.umami.is/docs/collect-data)、[跟踪配置](https://docs.umami.is/docs/tracker-configuration)、[事件跟踪](https://docs.umami.is/docs/track-events)、[排除自己的访问](https://docs.umami.is/docs/exclude-my-own-visits)。
