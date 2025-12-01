// 匹配 <svg> 开始标签及其属性
const svgTagRegex = /<svg([^>]*?)>/i;
// 匹配 width 或 height 属性（支持单引号和双引号）
const widthHeightRegex = /(width|height)\s*=\s*["']([^"']*?)["']/gi;
// 检查是否包含 viewBox 属性
const viewBoxRegex = /viewBox\s*=\s*["'][^"']*?["']/i;
// 匹配换行符和回车符
const lineBreakRegex = /[\r\n]+/g;

/**
 * 将 SVG 字符串转换为 <symbol> 元素
 * @param id - symbol 元素的 id 属性
 * @param svg - 原始 SVG 字符串
 * @returns 转换后的 <symbol> 元素字符串
 */
const svg2symbol = (id: string, svg: string): string => {
  if (!svg || typeof svg !== "string") {
    throw new Error(`Invalid SVG string provided: ${id}`);
  }

  // 移除所有换行符和回车符
  let content = svg.replace(lineBreakRegex, "").trim();

  // 提取 width 和 height 值，用于生成 viewBox
  let width = "0";
  let height = "0";

  // 替换 <svg> 标签为 <symbol> 标签
  content = content.replace(svgTagRegex, (_match, attributes: string) => {
    // 提取并移除 width 和 height 属性
    let cleanedAttributes = attributes.replace(
      widthHeightRegex,
      (_fullMatch: string, attrName: string, attrValue: string) => {
        const normalizedName = attrName.toLowerCase().trim();
        if (normalizedName === "width") {
          width = attrValue.trim();
        } else if (normalizedName === "height") {
          height = attrValue.trim();
        }
        return ""; // 移除 width 和 height 属性
      }
    );

    // 清理多余的空格
    cleanedAttributes = cleanedAttributes
      .replace(/\s+/g, " ") // 多个空格合并为一个
      .trim();

    // 如果原 SVG 没有 viewBox，则添加一个
    if (!viewBoxRegex.test(attributes)) {
      const space = cleanedAttributes ? " " : "";
      cleanedAttributes = `${cleanedAttributes}${space}viewBox="0 0 ${width} ${height}"`;
    }

    // 返回 <symbol> 标签，保留 id 和所有其他属性
    return cleanedAttributes
      ? `<symbol id="${id}" ${cleanedAttributes}>`
      : `<symbol id="${id}">`;
  });

  // 替换结束标签 </svg> 为 </symbol>
  content = content.replace(/<\/svg>/i, "</symbol>");

  return content;
};

export default svg2symbol;