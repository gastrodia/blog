import { theme } from "@store/theme";
import { GISCUS } from "@config";
import Giscus from "@giscus/react";
import { useStore } from "@nanostores/react";

const Comments = () => {
  const $theme = useStore(theme);

  return (
    <Giscus theme={$theme} {...GISCUS} />
    // <script
    //     is:inline
    //     src="https://giscus.app/client.js"
    //     data-repo="gastrodia/blog"
    //     data-repo-id="R_kgDOJ1bm_g"
    //     data-category="General"
    //     data-category-id="DIC_kwDOJ1bm_s4CnGP_"
    //     data-mapping="pathname"
    //     data-strict="0"
    //     data-reactions-enabled="1"
    //     data-emit-metadata="0"
    //     data-input-position="bottom"
    //     data-theme="preferred_color_scheme"
    //     data-lang="zh-CN"
    //     crossorigin="anonymous"
    //     async>
    // </script>
  );
};

export default Comments;
