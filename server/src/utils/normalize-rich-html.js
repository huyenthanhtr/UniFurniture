function normalizeMediaSource(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/uploads/")) return `http://localhost:3000${raw}`;
  return raw;
}

function normalizeRichHtml(html = "") {
  const source = String(html || "");
  if (!source.trim()) return "";

  let output = source;

  output = output.replace(/<(img|video|iframe)\b([^>]*?)\s+src=(["'])(.*?)\3([^>]*)>/gi, (match, tag, before, quote, src, after) => {
    const nextSrc = normalizeMediaSource(src);

    let attrs = `${before || ""} src=${quote}${nextSrc}${quote}${after || ""}`;
    attrs = attrs.replace(/\swidth=(["']).*?\1/gi, "");
    attrs = attrs.replace(/\sheight=(["']).*?\1/gi, "");

    const styleMatch = attrs.match(/\sstyle=(["'])(.*?)\1/i);
    const existingStyle = styleMatch ? styleMatch[2] : "";
    const cleanedStyle = existingStyle
      .replace(/(?:^|;)\s*width\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*height\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*max-width\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*max-height\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*object-fit\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*margin\s*:[^;]*/gi, "")
      .replace(/(?:^|;)\s*display\s*:[^;]*/gi, "")
      .trim()
      .replace(/^;|;$/g, "");

    const enforcedStyle = tag.toLowerCase() === "img"
      ? "display:block;margin:14px auto;width:70%;max-width:70%;height:auto;"
      : "display:block;margin:14px auto;width:70%;max-width:70%;height:auto;aspect-ratio:16 / 9;";

    const mergedStyle = cleanedStyle ? `${cleanedStyle};${enforcedStyle}` : enforcedStyle;

    if (styleMatch) {
      attrs = attrs.replace(/\sstyle=(["'])(.*?)\1/i, ` style="max-width:100%;box-sizing:border-box;${mergedStyle}"`);
    } else {
      attrs += ` style="max-width:100%;box-sizing:border-box;${mergedStyle}"`;
    }

    return `<${tag}${attrs}>`;
  });

  output = output.replace(/style=(["'])(.*?)\1/gi, (match, quote, style) => {
    if (/max-width\s*:|box-sizing\s*:/i.test(style)) {
      return `style=${quote}${style}${quote}`;
    }
    return `style=${quote}max-width:100%;box-sizing:border-box;${style}${quote}`;
  });

  return output;
}

module.exports = {
  normalizeRichHtml,
};
